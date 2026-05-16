// Supabase Edge Function: paymongo-create-checkout
// Always returns HTTP 200 with { ok, ... } so the browser can read the body.
// Reads env per-request so secret changes are picked up without manual redeploy.

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

  // Read env per-request so newly-saved secrets are picked up.
  const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY') || '';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  // Diagnostic: GET returns which env var names are visible to this function.
  if (req.method === 'GET') {
    const visible: Record<string, boolean> = {};
    for (const k of ['PAYMONGO_SECRET_KEY', 'PAYMONGO_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
      visible[k] = !!Deno.env.get(k);
    }
    return ok({ diagnostic: true, env_present: visible });
  }

  if (req.method !== 'POST') return fail('Method not allowed');

  if (!PAYMONGO_SECRET_KEY) {
    return fail('PAYMONGO_SECRET_KEY is not configured on the edge function. Set it under Project Settings → Edge Functions → Secrets, then retry.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  const { order_id, success_url, cancel_url } = body || {};
  if (!order_id) return fail('order_id is required');
  if (!success_url || !cancel_url) return fail('success_url and cancel_url are required');

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: order, error } = await sb.from('orders').select('*').eq('id', order_id).single();
  if (error || !order) return fail('Order not found', { db_error: error?.message });
  if (order.payment_status === 'paid') return fail('Order is already paid');

  const subtotal = Number(order.total_price || 0);
  const shipping = Number(order.shipping_fee || 0);
  const grandTotal = Math.max(0, subtotal + shipping);
  const amountCentavos = Math.round(grandTotal * 100);
  if (amountCentavos < 2000) return fail('Order total must be at least ₱20.00 to use PayMongo.');

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const itemCount = items.reduce((n: number, it: any) => n + Number(it.quantity || 0), 0);
  const orderRef = order.order_number || String(order.id).slice(0, 8);

  // PayMongo rejects malformed billing.email / billing.phone with a 400. Sanitize
  // before sending: trim whitespace, validate email shape, drop the field entirely
  // if it doesn't look right rather than passing a bad value.
  const rawEmail = String(order.customer_email || '').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
  const billingEmail = emailOk ? rawEmail : undefined;
  const rawPhone = String(order.customer_phone || '').trim();
  const billingPhone = rawPhone || undefined;
  const billingName = String(order.customer_name || '').trim() || undefined;

  const payload = {
    data: {
      attributes: {
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        line_items: [
          {
            currency: 'PHP',
            amount: amountCentavos,
            name: `SlimDose Order ${orderRef}`,
            quantity: 1,
            description: `${itemCount} item(s) + shipping`,
          },
        ],
        payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay', 'billease', 'qrph'],
        description: `SlimDose Order ${orderRef}`,
        reference_number: orderRef,
        success_url,
        cancel_url,
        billing: {
          name: billingName,
          email: billingEmail,
          phone: billingPhone,
        },
        metadata: {
          order_id: String(order.id),
          order_number: orderRef,
        },
      },
    },
  };

  const auth = btoa(`${PAYMONGO_SECRET_KEY}:`);
  let pmRes: Response;
  try {
    pmRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    return fail('Network error calling PayMongo', { detail: e?.message });
  }

  const result = await pmRes.json().catch(() => ({}));
  if (!pmRes.ok) {
    const detail = result?.errors?.[0]?.detail || `PayMongo HTTP ${pmRes.status}`;
    return fail(detail, { paymongo_status: pmRes.status, paymongo_body: result });
  }

  const checkoutId = result?.data?.id;
  const checkoutUrl = result?.data?.attributes?.checkout_url;
  if (!checkoutId || !checkoutUrl) {
    return fail('PayMongo response missing checkout_url', { paymongo_body: result });
  }

  await sb
    .from('orders')
    .update({ paymongo_checkout_id: checkoutId, payment_status: 'pending' })
    .eq('id', order.id);

  return ok({ checkout_url: checkoutUrl, checkout_id: checkoutId });
});
