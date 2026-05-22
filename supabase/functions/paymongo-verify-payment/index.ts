// Supabase Edge Function: paymongo-verify-payment
// Called from the browser when PayMongo redirects back with ?paymongo=success.
// Fetches the checkout session from PayMongo and, if a payment is recorded as
// paid, marks the order paid + records the payment id and method used.
// Idempotent: returns ok if the order is already paid.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ok(body: unknown) {
  return new Response(JSON.stringify({ ok: true, ...(body as object) }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
function fail(error: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('Method not allowed');

  const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY') || '';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!PAYMONGO_SECRET_KEY) return fail('PAYMONGO_SECRET_KEY is not configured');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  const { order_id } = body || {};
  if (!order_id) return fail('order_id is required');

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: order, error } = await sb.from('orders').select('*').eq('id', order_id).single();
  if (error || !order) return fail('Order not found', { db_error: error?.message });

  if (order.payment_status === 'paid') {
    return ok({
      already_paid: true,
      payment_status: 'paid',
      payment_method_used: order.paymongo_payment_method_used || null,
    });
  }

  if (!order.paymongo_checkout_id) {
    return fail('Order has no PayMongo checkout session');
  }

  const auth = btoa(`${PAYMONGO_SECRET_KEY}:`);
  let pmRes: Response;
  try {
    pmRes = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${order.paymongo_checkout_id}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
  } catch (e: any) {
    return fail('Network error calling PayMongo', { detail: e?.message });
  }

  const result = await pmRes.json().catch(() => ({}));
  if (!pmRes.ok) {
    const detail = result?.errors?.[0]?.detail || `PayMongo HTTP ${pmRes.status}`;
    return fail(detail, { paymongo_status: pmRes.status, paymongo_body: result });
  }

  const payments = Array.isArray(result?.data?.attributes?.payments)
    ? result.data.attributes.payments
    : [];
  const paid = payments.find((p: any) => p?.attributes?.status === 'paid');

  if (!paid) {
    const sessionStatus = result?.data?.attributes?.payment_intent?.attributes?.status
      || result?.data?.attributes?.status
      || 'unknown';
    return ok({
      already_paid: false,
      payment_status: 'pending',
      detail: `No paid payment on checkout session (status: ${sessionStatus})`,
    });
  }

  // PayMongo nests the actual method (card/gcash/paymaya/grab_pay/billease/qrph)
  // in a couple of possible spots depending on the source. Look in all of them.
  const pmMethod =
    paid?.attributes?.source?.type ||
    paid?.attributes?.payment_method?.type ||
    paid?.attributes?.payment_method_used ||
    null;

  // CAS update — only flip pending → paid. Whichever of {verify, webhook}
  // wins the race fires the downstream Telegram notification.
  const { data: flipped, error: updErr } = await sb
    .from('orders')
    .update({
      payment_status: 'paid',
      paymongo_payment_id: paid?.id || null,
      paymongo_payment_method_used: pmMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();

  if (updErr) return fail('Failed to update order', { db_error: updErr.message });

  if (flipped) {
    sb.functions
      .invoke('telegram-notify-order', { body: { order_id } })
      .catch((e) => console.error('paymongo-verify-payment: telegram notify failed', e));
  }

  return ok({
    already_paid: !flipped,
    payment_status: 'paid',
    payment_method_used: pmMethod,
  });
});
