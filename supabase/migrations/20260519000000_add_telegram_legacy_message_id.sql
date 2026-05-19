-- Track the Telegram message id in the legacy (non-forum) admin group, so the
-- bot can delete/repost it when the order status changes.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS telegram_legacy_message_id BIGINT;
