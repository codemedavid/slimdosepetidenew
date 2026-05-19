// Supabase Edge Function: telegram-webhook
// Receives Telegram callback button presses (from either the forum group or
// the legacy mirror group), updates order status, and re-routes the order
// message into the topic / chat that matches the new status.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deleteMessageSafe, NEXT_STATUS, sendOrderEverywhere, tg } from '../_shared/telegram.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TELEGRAM_GROUP_CHAT_ID = Deno.env.get('TELEGRAM_GROUP_CHAT_ID')!;
const TELEGRAM_LEGACY_CHAT_ID = Deno.env.get('TELEGRAM_LEGACY_CHAT_ID') || undefined;
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POSTHOG_API_KEY = Deno.env.get('POSTHOG_API_KEY') || '';
const POSTHOG_HOST = Deno.env.get('POSTHOG_HOST') || 'https://us.i.posthog.com';

async function posthogCapture(
  event: string,
  distinctId: string,
  properties: Record<string, unknown>,
) {
  if (!POSTHOG_API_KEY || !distinctId) return;
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event,
        distinct_id: distinctId,
        properties: { $lib: 'telegram-webhook', ...properties },
      }),
    });
  } catch (err) {
    console.error('posthog capture failed', event, err);
  }
}

function actorNameFrom(cb: any): string {
  const u = cb?.from || {};
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  if (u.username) return name ? `${name} (@${u.username})` : `@${u.username}`;
  return name || 'unknown';
}

Deno.serve(async (req) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const got = req.headers.get('x-telegram-bot-api-secret-token');
    if (got !== TELEGRAM_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const cb = update.callback_query;
  if (!cb) return new Response('ok');

  const data: string = cb.data || '';

  const [action, orderId] = data.split(':');
  if (!orderId || (action !== 'confirm' && action !== 'cancel' && action !== 'advance')) {
    await tg(TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Unknown action' });
    return new Response('ok');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch first so we know current status (for advance) and stored message ids.
  const { data: existing } = await admin
    .from('orders')
    .select('order_status, telegram_message_id, telegram_legacy_message_id, telegram_proof_message_id, telegram_legacy_proof_message_id')
    .eq('id', orderId)
    .single();

  if (!existing) {
    await tg(TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'Order not found',
      show_alert: true,
    });
    return new Response('ok');
  }

  let newStatus: string;
  if (action === 'confirm') newStatus = 'confirmed';
  else if (action === 'cancel') newStatus = 'cancelled';
  else {
    const next = NEXT_STATUS[existing.order_status];
    if (!next) {
      await tg(TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
        callback_query_id: cb.id,
        text: `Cannot advance from ${existing.order_status}`,
        show_alert: true,
      });
      return new Response('ok');
    }
    newStatus = next;
  }

  const updates: Record<string, unknown> = { order_status: newStatus };
  if (action === 'confirm') updates.payment_status = 'paid';

  const { data: updated, error } = await admin
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select('*')
    .single();

  if (error || !updated) {
    await tg(TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
      callback_query_id: cb.id,
      text: `Failed: ${error?.message || 'order not found'}`,
      show_alert: true,
    });
    return new Response('ok');
  }

  const distinctId = String(updated.customer_email || '').trim().toLowerCase();
  const fmt = (n: unknown) => Number(n ?? 0).toLocaleString('en-PH');
  const items: any[] = Array.isArray(updated.order_items) ? updated.order_items : [];
  const itemsSummary = items
    .map((i: any) => {
      const name = i.variation_name ? `${i.product_name} — ${i.variation_name}` : i.product_name;
      return `${i.quantity} × ${name} — ₱${Number(i.total ?? 0).toLocaleString('en-PH')}`;
    })
    .join('\n');
  const subtotalNum = Number(updated.total_price ?? 0) + Number(updated.discount_applied ?? 0);
  const finalTotalNum = Number(updated.total_price ?? 0) + Number(updated.shipping_fee ?? 0);
  const contact = String(updated.contact_method || '');
  const eventProps = {
    order_id: updated.id,
    order_number: updated.order_number ?? null,
    items_summary: itemsSummary,
    subtotal: fmt(subtotalNum),
    shipping_fee: fmt(updated.shipping_fee),
    discount: fmt(updated.discount_applied),
    promo_code: updated.promo_code || '',
    total_price: fmt(finalTotalNum),
    payment_method: updated.payment_method_name || '—',
    contact_method: contact ? contact.charAt(0).toUpperCase() + contact.slice(1) : '—',
    email: updated.customer_email ?? null,
    customer_name: updated.customer_name ?? null,
    order_status: newStatus,
    source: 'telegram',
  };
  await posthogCapture(`sldp_order_${newStatus}`, distinctId, eventProps);
  if (action === 'confirm') {
    await posthogCapture('sldp_payment_paid', distinctId, {
      ...eventProps,
      payment_status: 'paid',
    });
  }

  // Delete the previous order summary + payment proof photo in both groups,
  // then repost into the new topic / legacy chat. Telegram doesn't allow
  // moving messages between forum topics, so delete-and-repost is the
  // workaround.
  const oldForumId = existing.telegram_message_id ? Number(existing.telegram_message_id) : 0;
  const oldLegacyId = existing.telegram_legacy_message_id ? Number(existing.telegram_legacy_message_id) : 0;
  const oldForumProofId = existing.telegram_proof_message_id ? Number(existing.telegram_proof_message_id) : 0;
  const oldLegacyProofId = existing.telegram_legacy_proof_message_id ? Number(existing.telegram_legacy_proof_message_id) : 0;
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

  const actorName = actorNameFrom(cb);
  const { forum, legacy } = await sendOrderEverywhere({
    token: TELEGRAM_BOT_TOKEN,
    forumChatId: TELEGRAM_GROUP_CHAT_ID,
    legacyChatId: TELEGRAM_LEGACY_CHAT_ID,
    order: updated,
    status: newStatus,
    actorName,
  });

  await admin
    .from('orders')
    .update({
      telegram_message_id: forum.message_id ?? null,
      telegram_legacy_message_id: legacy.message_id ?? null,
      telegram_proof_message_id: forum.proof_message_id ?? null,
      telegram_legacy_proof_message_id: legacy.proof_message_id ?? null,
    })
    .eq('id', orderId);

  const toastMap: Record<string, string> = {
    confirm: 'Order confirmed and moved to process queue',
    cancel: 'Order cancelled',
    advance: `Moved to ${newStatus}`,
  };
  await tg(TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
    callback_query_id: cb.id,
    text: toastMap[action],
  });

  return new Response('ok');
});
