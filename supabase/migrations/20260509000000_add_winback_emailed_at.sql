-- Track when a 30-day win-back PostHog event has been emitted for an order,
-- so the winback-check Edge Function never double-sends.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS winback_emailed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_winback_lookup
  ON orders (created_at)
  WHERE winback_emailed_at IS NULL;
