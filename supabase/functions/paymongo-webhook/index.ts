// Supabase Edge Function: paymongo-webhook
// Server-to-server endpoint PayMongo calls when a payment event fires.
// Configure in PayMongo dashboard → Developers → Webhooks:
//   URL: https://<project>.supabase.co/functions/v1/paymongo-webhook
//   Events: payment.paid, checkout_session.payment.paid
// Set PAYMONGO_WEBHOOK_SECRET in Project Settings → Edge Functions → Secrets to
// the signing secret PayMongo shows when you create the webhook.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// PayMongo signs each webhook with header `paymongo-signature: t=<ts>,te=<sig>,li=<sig>`
// (te = test mode signature, li = live mode). Recompute HMAC-SHA256 over
// `<ts>.<rawBody>` with the webhook secret and compare to whichever signature
// is present.
async function verifySignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parts: Record<string, string> = {};
  for (const piece of header.split(',')) {
    const [k, v] = piece.split('=').map((s) => s.trim());
    if (k && v) parts[k] = v;
  }
  const ts = parts['t'];
  const sig = parts['te'] || parts['li'];
  if (!ts || !sig) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${rawBody}`));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Constant-time compare
  if (hex.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') {
    // Diagnostic: which env vars are visible to this function.
    const visible: Record<string, boolean> = {};
    for (const k of ['PAYMONGO_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
      visible[k] = !!Deno.env.get(k);
    }
    return reply(200, { ok: true, diagnostic: true, env_present: visible });
  }
  if (req.method !== 'POST') return reply(200, { ok: false, error: 'Method not allowed' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const WEBHOOK_SECRET = Deno.env.get('PAYMONGO_WEBHOOK_SECRET') || '';

  const rawBody = await req.text();
  const sigHeader = req.headers.get('paymongo-signature') || '';

  if (WEBHOOK_SECRET) {
    const valid = await verifySignature(rawBody, sigHeader, WEBHOOK_SECRET);
    if (!valid) {
      console.warn('paymongo-webhook: signature mismatch');
      return reply(401, { ok: false, error: 'Invalid signature' });
    }
  } else {
    console.warn('paymongo-webhook: PAYMONGO_WEBHOOK_SECRET not set — signature not verified');
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return reply(200, { ok: false, error: 'Invalid JSON' });
  }

  const type = event?.data?.attributes?.type;
  const inner = event?.data?.attributes?.data;

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // payment.failed → mark order as failed so admin knows. Look up by either
  // metadata.order_id or the payment id we may have already recorded.
  if (type === 'payment.failed') {
    const paymentId = inner?.id || null;
    const orderIdMeta = inner?.attributes?.metadata?.order_id || null;
    const match = orderIdMeta
      ? sb.from('orders').update({ payment_status: 'failed', updated_at: new Date().toISOString() }).eq('id', orderIdMeta)
      : paymentId
        ? sb.from('orders').update({ payment_status: 'failed', updated_at: new Date().toISOString() }).eq('paymongo_payment_id', paymentId)
        : null;
    if (match) {
      const { error: failErr } = await match;
      if (failErr) console.error('paymongo-webhook: failed-mark failed', failErr);
    }
    return reply(200, { ok: true, event: 'payment.failed' });
  }

  if (type !== 'payment.paid' && type !== 'checkout_session.payment.paid') {
    return reply(200, { ok: true, ignored: type });
  }

  // The payment object lives at `data.attributes.data` for payment.paid; for
  // checkout_session.payment.paid the inner data is the checkout session and
  // its paid payment is in `attributes.payments[]`.
  let paymentId: string | null = null;
  let paymentMethod: string | null = null;
  let checkoutId: string | null = null;
  let orderIdFromMetadata: string | null = null;

  if (type === 'payment.paid') {
    paymentId = inner?.id || null;
    const a = inner?.attributes || {};
    paymentMethod =
      a?.source?.type || a?.payment_method?.type || a?.payment_method_used || null;
    orderIdFromMetadata = a?.metadata?.order_id || null;
    // checkout_session id can be on the payment in a few shapes
    checkoutId =
      a?.checkout_session_id ||
      a?.checkout_session?.id ||
      a?.billing?.checkout_session_id ||
      null;
  } else {
    // checkout_session.payment.paid: inner is the checkout session
    checkoutId = inner?.id || null;
    const a = inner?.attributes || {};
    orderIdFromMetadata = a?.metadata?.order_id || null;
    const paid = Array.isArray(a?.payments)
      ? a.payments.find((p: any) => p?.attributes?.status === 'paid')
      : null;
    if (paid) {
      paymentId = paid?.id || null;
      paymentMethod =
        paid?.attributes?.source?.type ||
        paid?.attributes?.payment_method?.type ||
        paid?.attributes?.payment_method_used ||
        null;
    }
  }

  let order: any = null;
  if (orderIdFromMetadata) {
    const { data } = await sb
      .from('orders')
      .select('*')
      .eq('id', orderIdFromMetadata)
      .maybeSingle();
    order = data;
  }
  if (!order && checkoutId) {
    const { data } = await sb
      .from('orders')
      .select('*')
      .eq('paymongo_checkout_id', checkoutId)
      .maybeSingle();
    order = data;
  }
  if (!order) {
    console.warn('paymongo-webhook: order not found', {
      type,
      paymentId,
      checkoutId,
      orderIdFromMetadata,
    });
    // 200 so PayMongo doesn't retry forever for a stale/manual event.
    return reply(200, { ok: false, error: 'Order not found' });
  }

  if (order.payment_status === 'paid') {
    return reply(200, { ok: true, already_paid: true, order_id: order.id });
  }

  // CAS so only one of {webhook, verify-payment} fires the downstream Telegram
  // notification — whichever flips pending → paid first wins.
  const { data: flipped, error: updErr } = await sb
    .from('orders')
    .update({
      payment_status: 'paid',
      paymongo_payment_id: paymentId || order.paymongo_payment_id,
      paymongo_payment_method_used: paymentMethod || order.paymongo_payment_method_used,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();

  if (updErr) {
    console.error('paymongo-webhook: update failed', updErr);
    return reply(200, { ok: false, error: updErr.message });
  }

  if (flipped) {
    // Fire-and-forget: post the now-paid order into the Telegram admin group.
    sb.functions
      .invoke('telegram-notify-order', { body: { order_id: order.id } })
      .catch((e) => console.error('paymongo-webhook: telegram notify failed', e));
  }

  return reply(200, {
    ok: true,
    order_id: order.id,
    already_paid: !flipped,
    payment_method_used: paymentMethod,
  });
});
