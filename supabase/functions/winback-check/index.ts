// Supabase Edge Function: winback-check
//
// Intended to be invoked on a daily cron (e.g. pg_cron or Supabase Scheduled
// Functions). For each order placed >= 30 days ago that we haven't already
// processed, we check whether the same customer (matched by lowercased email
// OR lowercased name) has placed any newer order. If they have, we skip. If
// they haven't, we capture a PostHog event so a PostHog workflow / broadcast
// can deliver the actual win-back email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POSTHOG_API_KEY = Deno.env.get('POSTHOG_API_KEY')!;
const POSTHOG_HOST = Deno.env.get('POSTHOG_HOST') ?? 'https://us.i.posthog.com';

const WINDOW_DAYS = 30;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type OrderRow = {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  created_at: string;
  total_price: number | null;
  shipping_fee: number | null;
};

function norm(s: string | null | undefined) {
  return (s ?? '').trim().toLowerCase();
}

async function postHogCapture(event: string, distinctId: string, properties: Record<string, unknown>) {
  const res = await fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: POSTHOG_API_KEY,
      event,
      distinct_id: distinctId,
      properties,
      timestamp: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PostHog capture failed: ${res.status} ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error } = await admin
      .from('orders')
      .select('id, customer_email, customer_name, created_at, total_price, shipping_fee')
      .is('winback_emailed_at', null)
      .lte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
    }

    const results = { checked: 0, skipped_recent_order: 0, emailed: 0, errors: 0 };

    for (const order of (candidates ?? []) as OrderRow[]) {
      results.checked += 1;
      const email = norm(order.customer_email);
      const name = norm(order.customer_name);
      if (!email && !name) continue;

      // Look for any newer order from the same customer (email OR name match).
      const filters: string[] = [];
      if (email) filters.push(`customer_email.ilike.${email}`);
      if (name) filters.push(`customer_name.ilike.${name}`);

      const { data: newer, error: newerErr } = await admin
        .from('orders')
        .select('id')
        .or(filters.join(','))
        .gt('created_at', order.created_at)
        .limit(1);

      if (newerErr) {
        results.errors += 1;
        console.error('newer-order lookup failed', order.id, newerErr.message);
        continue;
      }

      if ((newer?.length ?? 0) > 0) {
        // Customer already came back — mark processed so we don't re-check forever.
        await admin
          .from('orders')
          .update({ winback_emailed_at: new Date().toISOString() })
          .eq('id', order.id);
        results.skipped_recent_order += 1;
        continue;
      }

      try {
        await postHogCapture('sldp_customer_winback_30d', email || `order:${order.id}`, {
          order_id: order.id,
          customer_email: email,
          customer_name: order.customer_name,
          last_order_at: order.created_at,
          last_order_total: Number(order.total_price ?? 0) + Number(order.shipping_fee ?? 0),
          days_since_last_order: WINDOW_DAYS,
          email: email,
        });

        await admin
          .from('orders')
          .update({ winback_emailed_at: new Date().toISOString() })
          .eq('id', order.id);

        results.emailed += 1;
      } catch (e) {
        results.errors += 1;
        console.error('posthog capture failed', order.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
