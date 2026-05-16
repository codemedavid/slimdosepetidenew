// Supabase Edge Function: paymongo-create-checkout
// Creates a PayMongo Checkout Session for an existing order and returns the
// hosted checkout URL. Supports cards, GCash, Maya, GrabPay, BillEase, and QRPH.
//
// Required env vars:
//   PAYMONGO_SECRET_KEY     - PayMongo secret key (sk_test_... or sk_live_...)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// PayMongo Checkout Session supported methods. QRPH is the InstaPay QR standard
// (one QR scannable by any participating PH bank/e-wallet app).
const PAYMENT_METHOD_TYPES = [
  'card',
  'gcash',
  'paymaya',
  'grab_pay',
  'billease',
  'qrph',
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function toCentavos(amount: number): number {
  return Math.round(Number(amount || 0) * 100);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  try {
    const { order_id, success_url, cancel_url } = await req.json();
    if (!order_id || !success_url || !cancel_url) {
      return json({ ok: false, error: 'Missing order_id, success_url, or cancel_url' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return json({ ok: false, error: `Order not found: ${orderErr?.message || 'unknown'}` }, 404);
    }

    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const subtotal = Number(order.total_price || 0);
    const shippingFee = Number(order.shipping_fee || 0);
    const lineItemsTotal = items.reduce(
      (sum: number, it: any) => sum + Number(it.total || 0),
      0,
    );

    const line_items = items.map((it: any) => ({
      currency: 'PHP',
      amount: toCentavos(Number(it.price || 0)),
      name: `${it.product_name}${it.variation_name ? ` (${it.variation_name})` : ''}`,
      quantity: Math.max(1, Number(it.quantity || 1)),
    }));

    // Represent any discount or shipping delta as a single adjustment line so
    // the checkout total matches the order's grand total exactly.
    const grand = subtotal + shippingFee;
    const delta = grand - lineItemsTotal;
    if (delta > 0) {
      line_items.push({
        currency: 'PHP',
        amount: toCentavos(delta),
        name: shippingFee > 0 ? 'Shipping & adjustments' : 'Adjustments',
        quantity: 1,
      });
    } else if (delta < 0) {
      // PayMongo line items can't be negative; bake the discount into the first item.
      if (line_items.length > 0) {
        line_items[0].amount = Math.max(
          0,
          line_items[0].amount + toCentavos(delta),
        );
      }
    }

    const payload = {
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items,
          payment_method_types: PAYMENT_METHOD_TYPES,
          success_url,
          cancel_url,
          reference_number: String(order.id),
          description: `Order ${String(order.id).slice(0, 8)}`,
          billing: {
            name: order.customer_name || undefined,
            email: order.customer_email || undefined,
            phone: order.customer_phone || undefined,
          },
        },
      },
    };

    const auth = btoa(`${PAYMONGO_SECRET_KEY}:`);
    const pmRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const pmJson = await pmRes.json();
    if (!pmRes.ok) {
      console.error('PayMongo error:', pmJson);
      const msg = pmJson?.errors?.[0]?.detail || 'PayMongo request failed';
      return json({ ok: false, error: msg, details: pmJson }, 502);
    }

    const checkout_url = pmJson?.data?.attributes?.checkout_url;
    const session_id = pmJson?.data?.id;
    if (!checkout_url) {
      return json({ ok: false, error: 'PayMongo did not return a checkout_url' }, 502);
    }

    await supabase
      .from('orders')
      .update({ paymongo_session_id: session_id })
      .eq('id', order_id);

    return json({ ok: true, checkout_url, session_id });
  } catch (e: any) {
    console.error('paymongo-create-checkout error:', e);
    return json({ ok: false, error: e?.message || 'Unexpected error' }, 500);
  }
});
