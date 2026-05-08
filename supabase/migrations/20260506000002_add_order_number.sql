/*
  # Add human-friendly Order Number (SDP12345 format)

  - Adds `order_number TEXT UNIQUE` to orders.
  - `generate_order_number()` returns 'SDP' + 5 random digits, retrying on collision.
  - BEFORE INSERT trigger populates `order_number` when not supplied.
  - Backfills existing rows.
  - Updates `get_order_details` to look up by order_number or UUID prefix
    and to return `order_number`.
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key
  ON orders(order_number)
  WHERE order_number IS NOT NULL;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  candidate TEXT;
  attempts  INT := 0;
BEGIN
  LOOP
    candidate := 'SDP' || lpad(floor(random() * 100000)::int::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = candidate);
    attempts := attempts + 1;
    IF attempts > 50 THEN
      -- Pool nearly full at this digit count; widen to 6 digits as a safety valve.
      candidate := 'SDP' || lpad(floor(random() * 1000000)::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = candidate);
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_order_number ON orders;
CREATE TRIGGER orders_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Backfill existing rows that don't have an order_number yet.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM orders WHERE order_number IS NULL ORDER BY created_at LOOP
    UPDATE orders SET order_number = generate_order_number() WHERE id = r.id;
  END LOOP;
END $$;

-- Refresh tracking lookup to support SDP numbers.
DROP FUNCTION IF EXISTS get_order_details(TEXT);

CREATE OR REPLACE FUNCTION get_order_details(order_id_input TEXT)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  order_status TEXT,
  payment_status TEXT,
  tracking_number TEXT,
  shipping_note TEXT,
  total_price DECIMAL(10,2),
  shipping_fee DECIMAL(10,2),
  order_items JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q TEXT := trim(order_id_input);
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.order_status,
    o.payment_status,
    o.tracking_number,
    o.shipping_note,
    o.total_price,
    o.shipping_fee,
    o.order_items,
    o.created_at
  FROM orders o
  WHERE
    upper(o.order_number) = upper(q)
    OR o.id::text ILIKE q || '%'
  ORDER BY (upper(o.order_number) = upper(q)) DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_order_details(TEXT) TO public;
