// Shared helpers for the Telegram order bot.
// The bot posts every order into the forum group's per-status topic, AND
// mirrors the same message (with buttons + status moves) into a legacy
// non-forum group when TELEGRAM_LEGACY_CHAT_ID is set.

// For each status, the env var(s) to look up — first one set wins. `processing`
// falls back to the "To Process" (confirmed) topic when a dedicated processing
// topic isn't configured, so both stages share that topic.
export const TOPIC_ENV: Record<string, string[]> = {
  new: ['TELEGRAM_TOPIC_NEW'],
  confirmed: ['TELEGRAM_TOPIC_CONFIRMED'],
  processing: ['TELEGRAM_TOPIC_PROCESSING', 'TELEGRAM_TOPIC_CONFIRMED'],
  shipped: ['TELEGRAM_TOPIC_SHIPPED'],
  delivered: ['TELEGRAM_TOPIC_DELIVERED'],
  cancelled: ['TELEGRAM_TOPIC_CANCELLED'],
};

export function getTopicId(status: string): number | undefined {
  const envKeys = TOPIC_ENV[status];
  if (!envKeys) return undefined;
  for (const key of envKeys) {
    const raw = Deno.env.get(key);
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function fmtPHP(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n || 0);
}

export function escapeHtml(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const STATUS_HEADERS: Record<string, string> = {
  new: '🛒 <b>New Order</b>',
  confirmed: '✅ <b>To Process</b>',
  processing: '✅ <b>To Process</b>',
  shipped: '🚚 <b>To Ship</b>',
  delivered: '📬 <b>Completed</b>',
  cancelled: '❌ <b>Cancelled</b>',
};

function formatUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

const ACTION_VERB: Record<string, string> = {
  confirmed: '✅ Confirmed',
  processing: '✅ Confirmed',
  shipped: '🚚 Moved to ship',
  delivered: '📬 Completed',
  cancelled: '❌ Cancelled',
};

export function buildActionLine(status: string, actorName?: string, at: Date = new Date()): string | undefined {
  const verb = ACTION_VERB[status];
  if (!verb) return undefined;
  const who = actorName ? ` by ${actorName}` : '';
  return `${verb}${who} at ${formatUtc(at)}`;
}

export function buildOrderMessage(order: any, statusOverride?: string, actorName?: string): string {
  const status = statusOverride || order.order_status || 'new';
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const lines = items.map((it: any) => {
    const name = escapeHtml(it.product_name || 'Item');
    const variation = it.variation_name ? ` (${escapeHtml(it.variation_name)})` : '';
    return `• ${name}${variation} × ${it.quantity} — ${fmtPHP(it.total)}`;
  });
  const subtotal = Number(order.total_price || 0);
  const shipping = Number(order.shipping_fee || 0);
  const grand = subtotal + shipping;
  const addr = [
    order.shipping_address,
    order.shipping_barangay,
    order.shipping_city,
    order.shipping_state,
    order.shipping_zip_code,
  ].filter(Boolean).map(escapeHtml).join(', ');

  const header = STATUS_HEADERS[status] || `📦 <b>Order</b>`;
  const shortId = String(order.id).slice(0, 8);
  const orderRef = order.order_number ? `#${escapeHtml(order.order_number)}` : `#${shortId}`;

  return [
    `${header} ${orderRef}`,
    ``,
    `<b>Customer:</b> ${escapeHtml(order.customer_name || '')}`,
    `<b>Email:</b> ${escapeHtml(order.customer_email || '')}`,
    `<b>Phone:</b> ${escapeHtml(order.customer_phone || '')}`,
    order.contact_method ? `<b>Contact via:</b> ${escapeHtml(order.contact_method)}` : '',
    ``,
    `<b>Items:</b>`,
    ...lines,
    ``,
    `<b>Subtotal:</b> ${fmtPHP(subtotal)}`,
    `<b>Shipping:</b> ${fmtPHP(shipping)} ${order.shipping_location ? `(${escapeHtml(order.shipping_location)})` : ''}`,
    `<b>Total:</b> ${fmtPHP(grand)}`,
    ``,
    `<b>Payment:</b> ${escapeHtml(order.payment_method_name || '—')}`,
    `<b>Address:</b> ${addr}`,
    order.notes ? `<b>Notes:</b> ${escapeHtml(order.notes)}` : '',
    order.tracking_number ? `<b>Tracking:</b> ${escapeHtml(order.tracking_number)}` : '',
    ``,
    `<b>Status:</b> ${escapeHtml(status)}`,
    (() => {
      const line = buildActionLine(status, actorName);
      return line ? escapeHtml(line) : '';
    })(),
  ].filter(Boolean).join('\n');
}

const ADVANCE_LABELS: Record<string, string> = {
  confirmed: '🚚 Move to Ship',
  processing: '🚚 Move to Ship',
  shipped: '📬 Mark as Completed',
};

export function buildReplyMarkup(status: string, orderId: string) {
  if (status === 'new') {
    return {
      inline_keyboard: [[
        { text: '✅ Confirm Order', callback_data: `confirm:${orderId}` },
        { text: '❌ Cancel', callback_data: `cancel:${orderId}` },
      ]],
    };
  }
  const label = ADVANCE_LABELS[status];
  if (!label) return undefined;
  return {
    inline_keyboard: [[
      { text: label, callback_data: `advance:${orderId}` },
    ]],
  };
}

export const NEXT_STATUS: Record<string, string> = {
  confirmed: 'shipped',
  processing: 'shipped',
  shipped: 'delivered',
};

export async function tg(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.ok !== false, json };
}

export interface SendOrderResult {
  message_id?: number;
  proof_message_id?: number;
  thread_id?: number;
  skipped?: boolean;
  error?: unknown;
}

// Send to a single chat (optionally targeting a forum topic). Returns the
// message ids (order summary + payment proof photo) we should remember for
// later delete/repost.
async function sendOrderToChat(opts: {
  token: string;
  chatId: string;
  threadId?: number;
  order: any;
  status: string;
  actorName?: string;
}): Promise<SendOrderResult> {
  const { token, chatId, threadId, order, status, actorName } = opts;
  const text = buildOrderMessage(order, status, actorName);
  const reply_markup = buildReplyMarkup(status, order.id);

  const { ok, json } = await tg(token, 'sendMessage', {
    chat_id: chatId,
    ...(threadId !== undefined ? { message_thread_id: threadId } : {}),
    text,
    parse_mode: 'HTML',
    ...(reply_markup ? { reply_markup } : {}),
  });
  if (!ok) {
    console.error('telegram sendMessage failed', { chatId, threadId, json });
    return { error: json };
  }
  const message_id = json.result?.message_id;

  let proof_message_id: number | undefined;
  if (order.payment_proof_url) {
    const photoRes = await tg(token, 'sendPhoto', {
      chat_id: chatId,
      ...(threadId !== undefined ? { message_thread_id: threadId } : {}),
      photo: order.payment_proof_url,
      caption: `Payment proof for ${order.order_number ? `#${order.order_number}` : `#${String(order.id).slice(0, 8)}`}`,
      reply_to_message_id: message_id,
    });
    if (photoRes.ok) {
      proof_message_id = photoRes.json.result?.message_id;
    } else {
      console.warn('telegram sendPhoto failed', { chatId, threadId, json: photoRes.json });
    }
  }

  return { message_id, proof_message_id, thread_id: threadId };
}

export interface DualSendResult {
  forum: SendOrderResult;
  legacy: SendOrderResult;
}

// Post (or repost) the order into both the forum topic for this status and the
// legacy mirror group, when each is configured. Skipped silently when not.
export async function sendOrderEverywhere(opts: {
  token: string;
  forumChatId: string;
  legacyChatId?: string;
  order: any;
  status: string;
  actorName?: string;
}): Promise<DualSendResult> {
  const { token, forumChatId, legacyChatId, order, status, actorName } = opts;
  const threadId = getTopicId(status);

  const forumPromise: Promise<SendOrderResult> = threadId === undefined
    ? Promise.resolve({ skipped: true })
    : sendOrderToChat({ token, chatId: forumChatId, threadId, order, status, actorName });

  const legacyPromise: Promise<SendOrderResult> = legacyChatId
    ? sendOrderToChat({ token, chatId: legacyChatId, order, status, actorName })
    : Promise.resolve({ skipped: true });

  const [forum, legacy] = await Promise.all([forumPromise, legacyPromise]);
  return { forum, legacy };
}

export async function deleteMessageSafe(token: string, chatId: string, messageId: number) {
  if (!messageId) return;
  const { ok, json } = await tg(token, 'deleteMessage', { chat_id: chatId, message_id: messageId });
  if (!ok) console.warn('telegram deleteMessage failed (may be too old)', { chatId, messageId, json });
}
