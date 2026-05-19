// Supabase Edge Function: telegram-move-order
// Called from the admin UI when an order's status changes. Deletes the previous
// messages in both the forum group and (if configured) the legacy mirror, then
// reposts the order into the topic that matches the new status.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deleteMessageSafe, sendOrderEverywhere } from '../_shared/telegram.ts';

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
    const { order_id, new_status, actor_name } = await req.json();
    if (!order_id || !new_status) {
      return new Response(JSON.stringify({ error: 'order_id and new_status required' }), { status: 400, headers: CORS });
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

    const oldForumId = order.telegram_message_id ? Number(order.telegram_message_id) : 0;
    const oldLegacyId = order.telegram_legacy_message_id ? Number(order.telegram_legacy_message_id) : 0;
    const oldForumProofId = order.telegram_proof_message_id ? Number(order.telegram_proof_message_id) : 0;
    const oldLegacyProofId = order.telegram_legacy_proof_message_id ? Number(order.telegram_legacy_proof_message_id) : 0;
    await Promise.all([
      oldForumId ? deleteMessageSafe(TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_CHAT_ID, oldForumId) : Promise.resolve(),
      oldForumProofId ? deleteMessageSafe(TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_CHAT_ID, oldForumProofId) : Promise.resolve(),
      oldLegacyId && TELEGRAM_LEGACY_CHAT_ID
        ? deleteMessageSafe(TELEGRAM_BOT_TOKEN, TELEGRAM_LEGACY_CHAT_ID, oldLegacyId)
        : Promise.resolve(),
      oldLegacyProofId && TELEGRAM_LEGACY_CHAT_ID
        ? deleteMessageSafe(TELEGRAM_BOT_TOKEN, TELEGRAM_LEGACY_CHAT_ID, oldLegacyProofId)
        : Promise.resolve(),
    ]);

    const { forum, legacy } = await sendOrderEverywhere({
      token: TELEGRAM_BOT_TOKEN,
      forumChatId: TELEGRAM_GROUP_CHAT_ID,
      legacyChatId: TELEGRAM_LEGACY_CHAT_ID,
      order,
      status: new_status,
      actorName: actor_name,
    });

    await admin
      .from('orders')
      .update({
        telegram_message_id: forum.message_id ?? null,
        telegram_legacy_message_id: legacy.message_id ?? null,
        telegram_proof_message_id: forum.proof_message_id ?? null,
        telegram_legacy_proof_message_id: legacy.proof_message_id ?? null,
      })
      .eq('id', order_id);

    return new Response(
      JSON.stringify({ ok: true, forum, legacy }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
