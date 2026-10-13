-- =============================================================================
-- SlimDose — full schema rebuild for a fresh Supabase project
-- =============================================================================
-- The old project (qqsvwakoergetbhkafnm) is gone and the repo migrations had
-- drifted from what was live. This file reconstructs the live schema from:
--   * supabase/migrations/* (bundle tiers, order numbers, telegram ids, winback,
--     oversell guard, price validation, global discounts, subscribers)
--   * the columns present in the 2026-10-01 data export
--   * the columns / RPCs the app reads in src/ and supabase/functions/
--
-- Run ONCE in the Supabase SQL editor of the new project, BEFORE the data files.
-- Safe to re-run: every object is created IF NOT EXISTS / OR REPLACE.
--
-- SECURITY NOTE: the admin panel authenticates with a client-side password and
-- writes through the public anon key, so (exactly like the old project) the anon
-- role needs read/write on the catalog and orders tables. RLS is ENABLED with
-- permissive policies so access can later be tightened per table without
-- schema changes.
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Package',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE,
  base_price DECIMAL(10,2) NOT NULL,
  raw_price DECIMAL(10,2) DEFAULT 0,
  discount_price DECIMAL(10,2),
  discount_start_date TIMESTAMPTZ,
  discount_end_date TIMESTAMPTZ,
  discount_active BOOLEAN DEFAULT false,
  purity_percentage DECIMAL(5,2) DEFAULT 99.00,
  molecular_weight TEXT,
  cas_number TEXT,
  sequence TEXT,
  storage_conditions TEXT DEFAULT 'Store at -20°C',
  inclusions TEXT[],
  stock_quantity INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  image_url TEXT,
  safety_sheet_url TEXT,
  coa_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON products(slug);

CREATE TABLE IF NOT EXISTS product_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity_mg DECIMAL(10,2) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2) DEFAULT 0,
  discount_price DECIMAL(10,2),
  discount_active BOOLEAN DEFAULT false,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_bundle_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL CHECK (min_quantity >= 2),
  discount_percentage NUMERIC NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  active BOOLEAN NOT NULL DEFAULT true,
  most_popular BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, min_quantity)
);

CREATE TABLE IF NOT EXISTS protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  dosage TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  notes TEXT[],
  storage TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT,
  file_url TEXT,
  content_type TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_number TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  qr_code_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'PRODUCT & USAGE',
  order_index INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coa_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  batch TEXT,
  test_date DATE NOT NULL,
  purity_percentage DECIMAL(5,3) NOT NULL,
  quantity TEXT NOT NULL,
  task_number TEXT NOT NULL,
  verification_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  featured BOOLEAN DEFAULT false,
  manufacturer TEXT DEFAULT 'SlimDose',
  laboratory TEXT DEFAULT 'Janoshik Analytical',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guide_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  preview TEXT,
  content TEXT NOT NULL,
  cover_image TEXT,
  author TEXT NOT NULL DEFAULT 'SlimDose Team',
  published_date DATE NOT NULL DEFAULT CURRENT_DATE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  related_product_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_purchase_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Site-wide Discount',
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT false,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  excluded_product_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'popup',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order numbers are sequential "SLD-001000" style (matches the exported data).
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  contact_method TEXT,
  shipping_address TEXT NOT NULL,
  shipping_barangay TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_zip_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'Philippines',
  shipping_region TEXT,
  shipping_location TEXT,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  courier_id TEXT,
  pricing_mode TEXT DEFAULT 'PHP',
  order_items JSONB NOT NULL,
  subtotal DECIMAL(10,2),
  total_price DECIMAL(10,2) NOT NULL,
  discount_applied DECIMAL(10,2) DEFAULT 0,
  payment_method_id TEXT,
  payment_method_name TEXT,
  payment_status TEXT DEFAULT 'pending',
  payment_proof_url TEXT,
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
  promo_code TEXT,
  notes TEXT,
  admin_notes TEXT,
  order_status TEXT DEFAULT 'new',
  tracking_number TEXT,
  tracking_courier TEXT,
  shipping_provider TEXT,
  shipping_note TEXT,
  shipped_at TIMESTAMPTZ,
  telegram_message_id BIGINT,
  telegram_legacy_message_id BIGINT,
  telegram_proof_message_id BIGINT,
  telegram_legacy_proof_message_id BIGINT,
  paymongo_checkout_id TEXT,
  paymongo_payment_id TEXT,
  paymongo_payment_method_used TEXT,
  winback_emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(available);
CREATE INDEX IF NOT EXISTS idx_product_variations_product_id ON product_variations(product_id);
CREATE INDEX IF NOT EXISTS product_bundle_tiers_product_id_idx ON product_bundle_tiers(product_id);
CREATE INDEX IF NOT EXISTS idx_protocols_product_id ON protocols(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_paymongo_checkout_id ON orders(paymongo_checkout_id);
CREATE INDEX IF NOT EXISTS idx_orders_paymongo_payment_id ON orders(paymongo_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_promo_code_id ON orders(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_orders_winback_lookup ON orders(created_at) WHERE winback_emailed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_faqs_order_idx ON faqs(order_index);
CREATE INDEX IF NOT EXISTS idx_guide_topics_display_order ON guide_topics(display_order);
CREATE INDEX IF NOT EXISTS subscribers_created_at_idx ON subscribers(created_at DESC);

-- =============================================================================
-- updated_at TRIGGERS
-- =============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories', 'products', 'product_bundle_tiers', 'protocols', 'payment_methods',
    'site_settings', 'faqs', 'shipping_locations', 'coa_reports', 'guide_topics',
    'promo_codes', 'global_discounts', 'orders'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON %1$I', t);
    EXECUTE format(
      'CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END $$;

-- =============================================================================
-- ORDER NUMBER (SLD-001234)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'SLD-' || lpad(nextval('order_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_order_number ON orders;
CREATE TRIGGER orders_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- =============================================================================
-- STOCK DECREMENT + OVERSELL GUARD (20260603000000)
-- =============================================================================

CREATE OR REPLACE FUNCTION decrement_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_product_id UUID;
  v_variation_id UUID;
  v_quantity INTEGER;
  v_available INTEGER;
  v_name TEXT;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.order_items)
  LOOP
    v_product_id := (item->>'product_id')::UUID;
    v_variation_id := NULLIF(item->>'variation_id', '')::UUID;
    v_quantity := (item->>'quantity')::INTEGER;

    IF v_variation_id IS NOT NULL THEN
      SELECT stock_quantity, name INTO v_available, v_name
      FROM product_variations WHERE id = v_variation_id FOR UPDATE;

      IF v_available IS NULL THEN
        RAISE EXCEPTION 'Product variation % no longer exists', v_variation_id;
      END IF;
      IF v_available < v_quantity THEN
        RAISE EXCEPTION 'Out of stock: % (only % left, % requested)',
          COALESCE(v_name, 'item'), v_available, v_quantity;
      END IF;

      UPDATE product_variations
      SET stock_quantity = stock_quantity - v_quantity
      WHERE id = v_variation_id;
    ELSE
      SELECT stock_quantity, name INTO v_available, v_name
      FROM products WHERE id = v_product_id FOR UPDATE;

      IF v_available IS NULL THEN
        RAISE EXCEPTION 'Product % no longer exists', v_product_id;
      END IF;
      IF v_available < v_quantity THEN
        RAISE EXCEPTION 'Out of stock: % (only % left, % requested)',
          COALESCE(v_name, 'item'), v_available, v_quantity;
      END IF;

      UPDATE products
      SET stock_quantity = stock_quantity - v_quantity
      WHERE id = v_product_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_decrement_stock ON orders;
CREATE TRIGGER trigger_decrement_stock
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION decrement_stock_on_order();

-- =============================================================================
-- SERVER-SIDE PRICE VALIDATION (20260607000000)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_authoritative_unit_base_price(
  p_product_id UUID,
  p_variation_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grace      INTERVAL := INTERVAL '1 day';
  v_now        TIMESTAMPTZ := now();
  v_base       NUMERIC;
  v_disc_price NUMERIC;
  v_disc_active BOOLEAN;
  v_disc_start TIMESTAMPTZ;
  v_disc_end   TIMESTAMPTZ;
  v_var_price  NUMERIC;
  v_var_disc_price NUMERIC;
  v_var_disc_active BOOLEAN;
  v_original   NUMERIC;
  v_individual NUMERIC;
  v_has_individual BOOLEAN;
  v_global_price NUMERIC;
  v_has_global BOOLEAN := false;
  gd           RECORD;
BEGIN
  SELECT base_price, discount_price, discount_active, discount_start_date, discount_end_date
    INTO v_base, v_disc_price, v_disc_active, v_disc_start, v_disc_end
  FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF p_variation_id IS NOT NULL THEN
    SELECT price, discount_price, discount_active
      INTO v_var_price, v_var_disc_price, v_var_disc_active
    FROM product_variations WHERE id = p_variation_id;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    v_original := v_var_price;
    IF v_var_disc_active AND v_var_disc_price IS NOT NULL THEN
      v_individual := v_var_disc_price;
    ELSE
      v_individual := v_var_price;
    END IF;
  ELSE
    v_original := v_base;
    IF v_disc_active AND v_disc_price IS NOT NULL
       AND (v_disc_start IS NULL OR v_now >= v_disc_start - v_grace)
       AND (v_disc_end   IS NULL OR v_now <= v_disc_end   + v_grace) THEN
      v_individual := v_disc_price;
    ELSE
      v_individual := v_base;
    END IF;
  END IF;

  v_has_individual := v_individual < v_original;

  v_global_price := v_original;
  SELECT * INTO gd FROM global_discounts
   WHERE active = true
     AND (start_date IS NULL OR v_now >= start_date - v_grace)
     AND (end_date   IS NULL OR v_now <= end_date   + v_grace)
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND AND NOT (p_product_id = ANY(COALESCE(gd.excluded_product_ids, '{}'::UUID[]))) THEN
    IF gd.discount_type = 'percentage' THEN
      v_global_price := round(v_original * (1 - gd.discount_value / 100.0));
    ELSE
      v_global_price := round(greatest(0, v_original - gd.discount_value));
    END IF;
    v_has_global := v_global_price < v_original;
  END IF;

  IF v_has_global AND (NOT v_has_individual OR v_global_price < v_individual) THEN
    RETURN v_global_price;
  END IF;

  RETURN v_individual;
END;
$$;

CREATE OR REPLACE FUNCTION validate_order_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grace        INTERVAL := INTERVAL '1 day';
  v_now          TIMESTAMPTZ := now();
  item           JSONB;
  v_product_id   UUID;
  v_variation_id UUID;
  v_quantity     INTEGER;
  v_submitted    NUMERIC;
  v_unit_base    NUMERIC;
  v_bundle_pct   NUMERIC;
  v_unit_final   NUMERIC;
  v_name         TEXT;
  v_auth_subtotal NUMERIC := 0;
  v_promo_discount NUMERIC := 0;
  v_auth_total   NUMERIC;
  promo          RECORD;
  c_unit_tol     NUMERIC := 1;
  c_total_tol    NUMERIC := 2;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.order_items)
  LOOP
    v_product_id   := (item->>'product_id')::UUID;
    v_variation_id := NULLIF(item->>'variation_id', '')::UUID;
    v_quantity     := (item->>'quantity')::INTEGER;
    v_submitted    := COALESCE((item->>'price')::NUMERIC, 0);
    v_name         := COALESCE(item->>'product_name', 'an item');

    v_unit_base := get_authoritative_unit_base_price(v_product_id, v_variation_id);
    IF v_unit_base IS NULL THEN
      RAISE EXCEPTION 'PRICE_CHANGED: % is no longer available. Please refresh your cart.', v_name;
    END IF;

    SELECT discount_percentage INTO v_bundle_pct
    FROM product_bundle_tiers
    WHERE product_id = v_product_id
      AND active = true
      AND min_quantity <= v_quantity
    ORDER BY min_quantity DESC
    LIMIT 1;
    v_bundle_pct := COALESCE(v_bundle_pct, 0);

    v_unit_final := v_unit_base * (1 - v_bundle_pct / 100.0);

    IF v_submitted < v_unit_final - c_unit_tol THEN
      RAISE EXCEPTION 'PRICE_CHANGED: The price for % has changed (now %, you have %). Please refresh your cart and try again.',
        v_name, round(v_unit_final, 2), round(v_submitted, 2);
    END IF;

    v_auth_subtotal := v_auth_subtotal + v_unit_final * v_quantity;
  END LOOP;

  IF NEW.promo_code_id IS NOT NULL THEN
    SELECT * INTO promo FROM promo_codes WHERE id = NEW.promo_code_id;
    IF FOUND
       AND promo.active
       AND (promo.start_date IS NULL OR v_now >= promo.start_date - v_grace)
       AND (promo.end_date   IS NULL OR v_now <= promo.end_date   + v_grace)
       AND (promo.usage_limit IS NULL OR promo.usage_count < promo.usage_limit)
       AND v_auth_subtotal >= COALESCE(promo.min_purchase_amount, 0)
    THEN
      IF promo.discount_type = 'percentage' THEN
        v_promo_discount := v_auth_subtotal * promo.discount_value / 100.0;
        IF promo.max_discount_amount IS NOT NULL THEN
          v_promo_discount := least(v_promo_discount, promo.max_discount_amount);
        END IF;
      ELSE
        v_promo_discount := promo.discount_value;
      END IF;
      v_promo_discount := least(v_promo_discount, v_auth_subtotal);
    END IF;
  END IF;

  v_auth_total := greatest(0, v_auth_subtotal - v_promo_discount);

  IF NEW.total_price < v_auth_total - c_total_tol THEN
    RAISE EXCEPTION 'PRICE_CHANGED: Your order total has changed (now %, you have %). Please refresh your cart and try again.',
      round(v_auth_total, 2), round(NEW.total_price, 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_order_prices ON orders;
CREATE TRIGGER trigger_validate_order_prices
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_prices();

-- =============================================================================
-- RPCs USED BY THE APP
-- =============================================================================

-- Order tracking page: returns a single JSON object (or NULL when not found).
DROP FUNCTION IF EXISTS get_order_details(TEXT);
CREATE FUNCTION get_order_details(order_id_input TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q TEXT := trim(order_id_input);
  result JSON;
BEGIN
  IF q IS NULL OR length(q) < 4 THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'order_status', o.order_status,
    'payment_status', o.payment_status,
    'tracking_number', o.tracking_number,
    'tracking_courier', o.tracking_courier,
    'shipping_provider', o.shipping_provider,
    'shipping_note', o.shipping_note,
    'total_price', o.total_price,
    'shipping_fee', o.shipping_fee,
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'product_name', it->>'product_name',
        'variation_name', it->>'variation_name',
        'quantity', (it->>'quantity')::INT))
      FROM jsonb_array_elements(o.order_items) it), '[]'::json),
    'courier_code', o.courier_id,
    'courier_name', NULL,
    'tracking_url_template', NULL,
    'created_at', o.created_at
  )
  INTO result
  FROM orders o
  WHERE upper(o.order_number) = upper(q)
     OR o.id::text ILIKE q || '%'
  ORDER BY (upper(o.order_number) = upper(q)) DESC
  LIMIT 1;

  RETURN result;
END;
$$;

-- Line items of paid, non-cancelled orders in a window, with unit cost resolved
-- the same way the CSV export does (variation cost_price, else product raw_price).
CREATE OR REPLACE FUNCTION sales_line_items(date_start TIMESTAMPTZ, date_end TIMESTAMPTZ)
RETURNS TABLE (
  order_id UUID,
  product_name TEXT,
  quantity NUMERIC,
  line_total NUMERIC,
  line_cost NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    it->>'product_name',
    COALESCE((it->>'quantity')::NUMERIC, 0),
    COALESCE((it->>'total')::NUMERIC,
             (it->>'price')::NUMERIC * (it->>'quantity')::NUMERIC, 0),
    COALESCE((it->>'quantity')::NUMERIC, 0)
      * COALESCE(NULLIF(v.cost_price, 0), p.raw_price, 0)
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.order_items) it
  LEFT JOIN product_variations v ON v.id = NULLIF(it->>'variation_id', '')::UUID
  LEFT JOIN products p ON p.id = COALESCE(NULLIF(it->>'product_id', '')::UUID, v.product_id)
  WHERE o.created_at >= date_start
    AND o.created_at <= date_end
    AND o.order_status <> 'cancelled'
    AND o.payment_status = 'paid';
$$;

CREATE OR REPLACE FUNCTION get_sales_analytics(date_start TIMESTAMPTZ, date_end TIMESTAMPTZ)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orders BIGINT;
  v_revenue NUMERIC;
  v_units NUMERIC;
  v_gross NUMERIC;
  v_cost NUMERIC;
BEGIN
  SELECT count(*), COALESCE(sum(total_price + COALESCE(shipping_fee, 0)), 0)
    INTO v_orders, v_revenue
  FROM orders
  WHERE created_at >= date_start
    AND created_at <= date_end
    AND order_status <> 'cancelled'
    AND payment_status = 'paid';

  SELECT COALESCE(sum(quantity), 0), COALESCE(sum(line_total), 0), COALESCE(sum(line_cost), 0)
    INTO v_units, v_gross, v_cost
  FROM sales_line_items(date_start, date_end);

  RETURN json_build_object(
    'total_orders', v_orders,
    'total_units', v_units,
    'gross_sales', round(v_gross, 2),
    'total_cost', round(v_cost, 2),
    'net_profit', round(v_gross - v_cost, 2),
    'total_revenue', round(v_revenue, 2),
    'average_order_value', CASE WHEN v_orders > 0 THEN round(v_revenue / v_orders, 2) ELSE 0 END
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_product_rankings_v2(
  date_start TIMESTAMPTZ,
  date_end TIMESTAMPTZ,
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  product_name TEXT,
  units_sold NUMERIC,
  revenue NUMERIC,
  cost NUMERIC,
  profit NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.product_name,
    sum(s.quantity),
    round(sum(s.line_total), 2),
    round(sum(s.line_cost), 2),
    round(sum(s.line_total) - sum(s.line_cost), 2)
  FROM sales_line_items(date_start, date_end) s
  GROUP BY s.product_name
  ORDER BY sum(s.quantity) DESC, sum(s.line_total) DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION get_order_details(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sales_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_product_rankings_v2(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO anon, authenticated;

-- Internal helpers: only called by triggers or other SECURITY DEFINER functions,
-- never directly through the API (triggers fire regardless of EXECUTE grants).
REVOKE EXECUTE ON FUNCTION decrement_stock_on_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION validate_order_prices() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_authoritative_unit_base_price(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION sales_line_items(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_order_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION update_updated_at_column() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION update_updated_at_column() SET search_path = public;

-- =============================================================================
-- ACCESS: grants + RLS (see SECURITY NOTE at top)
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories', 'products', 'product_variations', 'product_bundle_tiers', 'protocols',
    'payment_methods', 'site_settings', 'faqs', 'shipping_locations', 'coa_reports',
    'guide_topics', 'promo_codes', 'global_discounts', 'orders'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "app_full_access" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "app_full_access" ON %I FOR ALL TO anon, authenticated
         USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Subscribers: anyone may sign up, only authenticated users may read.
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can subscribe" ON subscribers;
CREATE POLICY "Anyone can subscribe" ON subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (email IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can read subscribers" ON subscribers;
CREATE POLICY "Authenticated can read subscribers" ON subscribers
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- REALTIME (admin orders + analytics listen for new orders)
-- =============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('payment-proofs', 'payment-proofs', true, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('menu-images', 'menu-images', true, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('coa-images', 'coa-images', true, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']),
  ('article-covers', 'article-covers', true, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "slimdose public read" ON storage.objects;
CREATE POLICY "slimdose public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('payment-proofs', 'menu-images', 'coa-images', 'article-covers'));

DROP POLICY IF EXISTS "slimdose public upload" ON storage.objects;
CREATE POLICY "slimdose public upload" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id IN ('payment-proofs', 'menu-images', 'coa-images', 'article-covers'));

-- Admin image replace/delete (not allowed on customer payment proofs).
DROP POLICY IF EXISTS "slimdose admin update" ON storage.objects;
CREATE POLICY "slimdose admin update" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id IN ('menu-images', 'coa-images', 'article-covers'));

DROP POLICY IF EXISTS "slimdose admin delete" ON storage.objects;
CREATE POLICY "slimdose admin delete" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id IN ('menu-images', 'coa-images', 'article-covers'));
