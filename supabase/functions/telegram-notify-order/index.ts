// Supabase Edge Function: telegram-notify-order
// Sends a new-order message to the forum group's "new orders" topic and, when
// configured, mirrors the same message into the legacy admin group.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendOrderEverywhere } from '../_shared/telegram.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TELEGRAM_GROUP_CHAT_ID = Deno.env.get('TELEGRAM_GROUP_CHAT_ID')!;
const TELEGRAM_LEGACY_CHAT_ID = Deno.env.get('TELEGRAM_LEGACY_CHAT_ID') || undefined;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id required' }), { status: 400, headers: CORS });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error } = await admin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (error || !order) {
      return new Response(JSON.stringify({ error: error?.message || 'order not found' }), { status: 404, headers: CORS });
    }

    const { forum, legacy } = await sendOrderEverywhere({
      token: TELEGRAM_BOT_TOKEN,
      forumChatId: TELEGRAM_GROUP_CHAT_ID,
      legacyChatId: TELEGRAM_LEGACY_CHAT_ID,
      order,
      status: 'new',
    });

    if (forum.error && legacy.error) {
      return new Response(JSON.stringify({ error: 'telegram send failed', forum: forum.error, legacy: legacy.error }), { status: 502, headers: CORS });
    }

    const updates: Record<string, unknown> = {};
    if (forum.message_id) updates.telegram_message_id = forum.message_id;
    if (legacy.message_id) updates.telegram_legacy_message_id = legacy.message_id;
    if (forum.proof_message_id) updates.telegram_proof_message_id = forum.proof_message_id;
    if (legacy.proof_message_id) updates.telegram_legacy_proof_message_id = legacy.proof_message_id;
    if (Object.keys(updates).length) {
      await admin.from('orders').update(updates).eq('id', order.id);
    }

    return new Response(
      JSON.stringify({ ok: true, forum, legacy }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
