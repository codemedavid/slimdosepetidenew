-- Track the Telegram message id of the payment-proof photo in both the forum
-- group and the legacy mirror group, so the bot can delete both the order
-- summary AND its proof attachment when the order moves to the next stage.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS telegram_proof_message_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_legacy_proof_message_id BIGINT;
