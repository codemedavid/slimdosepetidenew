-- =============================================
-- PeptalkPH Complete Database Setup
-- Generated: 2025-12-27
-- All RLS DISABLED for easy development
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DROP EXISTING TABLES (Clean Slate)
-- =============================================

DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS coa_reports CASCADE;
DROP TABLE IF EXISTS guide_topics CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_variations CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;
DROP TABLE IF EXISTS faqs CASCADE;
DROP TABLE IF EXISTS shipping_locations CASCADE;

-- =============================================
-- CREATE TABLES
-- =============================================

-- Categories table
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Package',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES categories(id),
  base_price DECIMAL(10,2) NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Variations table
CREATE TABLE product_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity_mg DECIMAL(10,2) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  discount_price DECIMAL(10,2),
  discount_active BOOLEAN DEFAULT false,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Methods table
CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  qr_code_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site Settings table
CREATE TABLE site_settings (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQs table
CREATE TABLE faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'PRODUCT & USAGE',
  order_index INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipping Locations table
CREATE TABLE shipping_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COA Reports table
CREATE TABLE coa_reports (
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
  manufacturer TEXT DEFAULT 'PeptalkPH',
  laboratory TEXT DEFAULT 'Janoshik Analytical',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_zip_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'Philippines',
  shipping_location_id TEXT,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  order_items JSONB NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  payment_method_id TEXT,
  payment_method_name TEXT,
  payment_status TEXT DEFAULT 'pending',
  payment_proof_url TEXT,
  promo_code_id UUID,
  promo_code TEXT,
  discount_applied DECIMAL(10,2) DEFAULT 0,
  order_status TEXT DEFAULT 'new',
  tracking_number TEXT,
  tracking_courier TEXT,
  shipping_note TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guide Topics table
CREATE TABLE guide_topics (
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

-- Promo Codes table
CREATE TABLE promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
  max_discount_amount DECIMAL(10, 2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for orders -> promo_codes
ALTER TABLE orders ADD CONSTRAINT orders_promo_code_fk 
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id);

-- =============================================
-- CREATE INDEXES
-- =============================================

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_available ON products(available);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_product_variations_product_id ON product_variations(product_id);
CREATE INDEX idx_categories_active ON categories(active);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_order_status ON orders(order_status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_id ON orders(order_id);
CREATE INDEX idx_coa_reports_product_name ON coa_reports(product_name);
CREATE INDEX idx_coa_reports_featured ON coa_reports(featured);
CREATE INDEX idx_faqs_order_idx ON faqs(order_index ASC);
CREATE INDEX idx_faqs_category ON faqs(category);
CREATE INDEX idx_faqs_active ON faqs(is_active);
CREATE INDEX idx_shipping_locations_order ON shipping_locations(order_index ASC);
CREATE INDEX idx_guide_topics_display_order ON guide_topics(display_order);
CREATE INDEX idx_guide_topics_enabled ON guide_topics(is_enabled);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active ON promo_codes(active);

-- =============================================
-- CREATE TRIGGERS
-- =============================================

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_coa_reports_updated_at ON coa_reports;
CREATE TRIGGER update_coa_reports_updated_at BEFORE UPDATE ON coa_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_guide_topics_updated_at ON guide_topics;
CREATE TRIGGER update_guide_topics_updated_at BEFORE UPDATE ON guide_topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- AUTO INVENTORY DEDUCTION
-- =============================================

CREATE OR REPLACE FUNCTION decrement_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
      -- Lock the row so concurrent checkouts can't both pass the check.
      SELECT stock_quantity, name INTO v_available, v_name
      FROM product_variations
      WHERE id = v_variation_id
      FOR UPDATE;

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
      FROM products
      WHERE id = v_product_id
      FOR UPDATE;

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
FOR EACH ROW
EXECUTE FUNCTION decrement_stock_on_order();

-- =============================================
-- SALES ANALYTICS FUNCTIONS
-- =============================================

-- Drop existing functions first (required when changing return types)
DROP FUNCTION IF EXISTS get_dashboard_metrics(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_product_rankings(timestamptz, timestamptz, int);
DROP FUNCTION IF EXISTS get_order_details(text);

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  date_start timestamptz,
  date_end timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_orders bigint;
  total_revenue decimal(10,2);
  total_units bigint;
  avg_order_value decimal(10,2);
BEGIN
  SELECT 
    count(distinct id),
    coalesce(sum(total_price + coalesce(shipping_fee, 0)), 0)
  INTO 
    total_orders,
    total_revenue
  FROM orders
  WHERE created_at >= date_start 
  AND created_at <= date_end
  AND order_status in ('confirmed', 'processing', 'shipped', 'delivered')
  AND payment_status = 'paid';

  SELECT 
    coalesce(sum((item->>'quantity')::int), 0)
  INTO 
    total_units
  FROM orders,
  jsonb_array_elements(order_items) as item
  WHERE created_at >= date_start 
  AND created_at <= date_end
  AND order_status in ('confirmed', 'processing', 'shipped', 'delivered')
  AND payment_status = 'paid';

  IF total_orders > 0 THEN
    avg_order_value := total_revenue / total_orders;
  ELSE
    avg_order_value := 0;
  END IF;

  RETURN json_build_object(
    'total_orders', total_orders,
    'total_revenue', total_revenue,
    'total_units', total_units,
    'average_order_value', avg_order_value
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_product_rankings(
  date_start timestamptz,
  date_end timestamptz,
  limit_count int default 10
)
RETURNS TABLE (
  product_name text,
  units_sold bigint,
  revenue decimal(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH expanded_items AS (
    SELECT
      (item->>'product_name')::text as p_name,
      (item->>'quantity')::int as quantity,
      ((item->>'price')::decimal(10,2) * (item->>'quantity')::int) as row_total
    FROM orders,
    jsonb_array_elements(order_items) as item
    WHERE created_at >= date_start 
    AND created_at <= date_end
    AND order_status in ('confirmed', 'processing', 'shipped', 'delivered')
    AND payment_status = 'paid'
  )
  SELECT
    p_name,
    sum(quantity)::bigint as total_units,
    sum(row_total)::decimal(10,2) as total_rev
  FROM expanded_items
  GROUP BY p_name
  ORDER BY total_units DESC, total_rev DESC
  LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_order_details(order_id_input TEXT)
RETURNS TABLE (
  order_id TEXT,
  customer_name TEXT,
  order_status TEXT,
  tracking_number TEXT,
  tracking_courier TEXT,
  created_at TIMESTAMPTZ,
  order_items JSONB,
  total_price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.order_id,
    o.customer_name,
    o.order_status,
    o.tracking_number,
    o.tracking_courier,
    o.created_at,
    o.order_items,
    o.total_price
  FROM orders o
  WHERE o.order_id = order_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DISABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE faqs DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE coa_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE guide_topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes DISABLE ROW LEVEL SECURITY;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT ALL ON categories TO anon, authenticated;
GRANT ALL ON products TO anon, authenticated;
GRANT ALL ON product_variations TO anon, authenticated;
GRANT ALL ON payment_methods TO anon, authenticated;
GRANT ALL ON site_settings TO anon, authenticated;
GRANT ALL ON faqs TO anon, authenticated;
GRANT ALL ON shipping_locations TO anon, authenticated;
GRANT ALL ON coa_reports TO anon, authenticated;
GRANT ALL ON orders TO anon, authenticated;
GRANT ALL ON guide_topics TO anon, authenticated;
GRANT ALL ON promo_codes TO anon, authenticated;

-- =============================================
-- INSERT DEFAULT DATA - CATEGORIES
-- =============================================

INSERT INTO categories (id, name, icon, sort_order, active) VALUES
('all', 'All Peptides', 'Package', 0, true),
('research', 'Research Peptides', 'FlaskConical', 1, true),
('cosmetic', 'Cosmetic & Skincare', 'Sparkles', 2, true),
('wellness', 'Wellness & Support', 'Leaf', 3, true),
('supplies', 'Supplies & Accessories', 'Package', 4, true);

-- =============================================
-- INSERT DEFAULT DATA - SITE SETTINGS
-- =============================================

INSERT INTO site_settings (id, value, type, description) VALUES
('site_name', 'PeptalkPH', 'text', 'Website name'),
('site_tagline', 'Premium Peptide Solutions', 'text', 'Website tagline'),
('site_logo', '', 'image', 'Logo URL'),
('contact_email', 'support@peptalkph.com', 'email', 'Contact email'),
('contact_phone', '+63 XXX XXX XXXX', 'text', 'Contact phone number'),
('whatsapp_number', '+63 977 813 2630', 'text', 'WhatsApp number'),
('min_order_amount', '0', 'number', 'Minimum order amount'),
('free_shipping_threshold', '5000', 'number', 'Free shipping threshold'),
('disclaimer', 'All peptides are sold for research purposes only. Not for human consumption.', 'text', 'Legal disclaimer'),
('hero_badge_text', 'Premium Peptide Solutions', 'string', 'Text displayed in the badge pill'),
('hero_title_prefix', 'Premium', 'string', 'First part of the main headline'),
('hero_title_highlight', 'Peptides', 'string', 'Highlighted part of the main headline'),
('hero_title_suffix', '& Essentials', 'string', 'Last part of the main headline'),
('hero_subtext', 'From the Lab to You — Simplifying Science, One Dose at a Time.', 'string', 'Text next to title'),
('hero_tagline', 'Quality-tested products. Reliable performance. Trusted by our community.', 'string', 'Secondary tagline'),
('hero_description', 'Premium peptides, peptide pens, and essential accessories for your wellness routine.', 'string', 'Main description'),
('hero_accent_color', 'gold-500', 'string', 'Accent color class');

-- =============================================
-- INSERT DEFAULT DATA - SHIPPING LOCATIONS
-- =============================================

INSERT INTO shipping_locations (id, name, fee, is_active, order_index) VALUES
('NCR', 'NCR (Metro Manila)', 75, true, 1),
('LUZON', 'Luzon (Outside NCR)', 100, true, 2),
('VISAYAS_MINDANAO', 'Visayas & Mindanao', 130, true, 3);

-- =============================================
-- INSERT DEFAULT DATA - PAYMENT METHODS
-- =============================================

INSERT INTO payment_methods (id, name, account_number, account_name, active, sort_order) VALUES
('gcash', 'GCash', '09XX XXX XXXX', 'PeptalkPH', true, 1),
('maya', 'Maya', '09XX XXX XXXX', 'PeptalkPH', true, 2),
('bank', 'Bank Transfer', 'XXXX-XXXX-XXXX', 'PeptalkPH', true, 3);

-- =============================================
-- INSERT DEFAULT DATA - FAQs
-- =============================================

INSERT INTO faqs (question, answer, category, order_index, is_active) VALUES
('Can I use Tirzepatide?', 'Before purchasing, please check if Tirzepatide is suitable for you.
✔️ View the checklist here — Contact us for more details.', 'PRODUCT & USAGE', 1, true),
('Do you reconstitute (recon) Tirzepatide?', 'Yes — for Metro Manila orders only.
I provide free reconstitution when you purchase the complete set.
I use pharma-grade bacteriostatic water, and I ship it with an ice pack + insulated pouch to maintain stability.', 'PRODUCT & USAGE', 2, true),
('What size needles and cartridges do you offer?', '• Needles: Compatible with all insulin-style pens (standard pen needle sizes).
• Cartridges: Standard 3mL capacity.', 'PRODUCT & USAGE', 3, true),
('Can the pen pusher be retracted?', '• Reusable pens: Yes, the pusher can be retracted.
• Disposable pens: The pusher cannot be retracted and will stay forward once pushed.', 'PRODUCT & USAGE', 4, true),
('How should peptides be stored?', 'Peptides must be stored in the refrigerator, especially once reconstituted.', 'PRODUCT & USAGE', 5, true),
('What''s included in my order?', 'Depending on your chosen items:
• 3mL cartridge
• Pen needles
• Optional: alcohol swabs
• Free Tirzepatide reconstitution for Metro Manila set orders', 'ORDERING & PACKAGING', 6, true),
('Do you offer bundles or discounts?', 'Yes — I offer curated bundles and custom sets.
Message me for personalized bundle options.', 'ORDERING & PACKAGING', 7, true),
('Can I return items?', '• Pens: Returnable within 1 week if defective.
• Needles and syringes: Not returnable for hygiene and safety.', 'ORDERING & PACKAGING', 8, true),
('What payment options do you accept?', '• GCash
• Security Bank
• BDO

❌ COD is not accepted, except for Lalamove
→ You can pay the rider directly or have the rider pay upfront on your behalf.', 'PAYMENT METHODS', 9, true),
('Where are you located?', '📍 Merville, Parañaque City', 'SHIPPING & DELIVERY', 10, true),
('How long is shipping?', '📦 J&T Express: Usually 2–3 days
(Transit time may vary by location and sorting)', 'SHIPPING & DELIVERY', 11, true),
('When do orders ship out?', 'Orders placed before 11:00 AM ship out on the next J&T schedule (Tuesday & Thursday)
→ Subject to order volume.', 'SHIPPING & DELIVERY', 12, true),
('Do you ship nationwide?', 'Yes —
• J&T Express (nationwide)
• Lalamove (Metro Manila & nearby areas)', 'SHIPPING & DELIVERY', 13, true);

-- =============================================
-- INSERT PRODUCTS WITH VARIATIONS
-- =============================================

-- TIRZEPATIDE
DO $$
DECLARE
  product_id_tirzepatide UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('Tirzepatide', 'Tirzepatide is a dual GIP/GLP-1 receptor agonist. Research-grade peptide for metabolic studies. Available in multiple strengths.', 'research', 2499.00, 99.5, 0, true, true, 'Store at -20°C for long-term storage. Reconstituted at 2-8°C for up to 30 days.')
  RETURNING id INTO product_id_tirzepatide;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id_tirzepatide, '15mg', 15.0, 2499.00, 32),
  (product_id_tirzepatide, '20mg', 20.0, 2899.00, 5),
  (product_id_tirzepatide, '30mg', 30.0, 3499.00, 25);
END $$;

-- GHK-CU
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('GHK-CU', 'Copper peptide complex with regenerative properties. Known for its potential in tissue repair, wound healing, and anti-aging research applications.', 'cosmetic', 1199.00, 99.0, 0, true, true, 'Store at -20°C protected from light.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '50mg', 50.0, 1199.00, 7),
  (product_id, '100mg', 100.0, 1850.00, 4);
END $$;

-- NAD+
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('NAD+', 'Nicotinamide Adenine Dinucleotide - Essential coenzyme involved in cellular energy production and metabolic processes.', 'wellness', 1299.00, 99.5, 0, true, true, 'Store at -20°C. Protect from light and moisture.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '100mg', 100.0, 1299.00, 1),
  (product_id, '500mg', 500.0, 2199.00, 2);
END $$;

-- SEMAX
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('Semax', 'Nootropic peptide derived from ACTH that enhances cognitive function, memory, and provides neuroprotective effects.', 'wellness', 1399.00, 98.8, 0, true, true, 'Store at -20°C. Reconstituted at 2-8°C for up to 30 days.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '5mg', 5.0, 1399.00, 2),
  (product_id, '10mg', 10.0, 1699.00, 1);
END $$;

-- SELANK
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('Selank', 'Anxiolytic peptide with nootropic properties. Research-grade peptide for cognitive enhancement studies.', 'wellness', 1499.00, 99.0, 0, false, false, 'Store at -20°C.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '5mg', 5.0, 1499.00, 0),
  (product_id, '10mg', 10.0, 1799.00, 2);
END $$;

-- CAGRILINTIDE
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('Cagrilintide', 'Amylin receptor agonist for metabolic research. Research-grade peptide for weight management studies.', 'research', 1799.00, 99.0, 0, true, false, 'Store at -20°C.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '5mg', 5.0, 1799.00, 3),
  (product_id, '10mg', 10.0, 2299.00, 3);
END $$;

-- AOD-9604
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('AOD-9604', 'Modified fragment of human growth hormone (HGH) C-terminus. Researched for its potential metabolic effects.', 'research', 2099.00, 99.0, 3, true, false, 'Store at -20°C.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '5mg', 5.0, 2099.00, 3);
END $$;

-- KISSPEPTIN
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('Kisspeptin', 'Reproductive hormone peptide. Research-grade peptide for hormonal studies.', 'wellness', 1699.00, 99.0, 0, true, false, 'Store at -20°C.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '5mg', 5.0, 1699.00, 3),
  (product_id, '10mg', 10.0, 2399.00, 1);
END $$;

-- PT-141
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('PT-141', 'Bremelanotide peptide. Research-grade peptide for sexual health studies.', 'wellness', 1499.00, 99.0, 0, true, false, 'Store at -20°C.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '10mg', 10.0, 1499.00, 3),
  (product_id, '15mg', 15.0, 2899.00, 0);
END $$;

-- RETATRUTIDE
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('Retatrutide', 'Triple agonist peptide for metabolic research. Research-grade peptide for weight management studies.', 'research', 3499.00, 99.5, 0, false, true, 'Store at -20°C.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '20mg', 20.0, 3499.00, 0),
  (product_id, '30mg', 30.0, 4299.00, 1);
END $$;

-- GLOW (BPC-157, GHK-CU, TB500)
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('GLOW (BPC-157, GHK-CU, TB500)', 'Premium blend of BPC-157, GHK-CU, and TB500 peptides. Complete recovery and regenerative peptide combination.', 'wellness', 2899.00, 99.0, 1, true, true, 'Store at -20°C.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '70mg', 70.0, 2899.00, 1);
END $$;

-- GLUTATHIONE
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('Glutathione', 'Master antioxidant peptide. Essential for cellular protection and detoxification. Research-grade quality.', 'wellness', 1499.00, 99.0, 28, true, true, 'Store at -20°C.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '1500mg', 1500.0, 1499.00, 28);
END $$;

-- LEMON BOTTLE
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('Lemon Bottle', 'Fat-dissolving injection solution. Professional-grade cosmetic product.', 'cosmetic', 1299.00, 99.0, 5, true, false, 'Store at room temperature.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '10ml', 10.0, 1299.00, 5);
END $$;

-- LIPO-C WITH B12
DO $$
DECLARE
  product_id UUID;
BEGIN
  INSERT INTO products (name, description, category, base_price, purity_percentage, stock_quantity, available, featured, storage_conditions)
  VALUES ('Lipo-C with B12', 'Fat-burning injection solution with Vitamin B12. Professional-grade cosmetic product.', 'cosmetic', 1699.00, 99.0, 1, true, false, 'Store at room temperature.')
  RETURNING id INTO product_id;

  INSERT INTO product_variations (product_id, name, quantity_mg, price, stock_quantity) VALUES
  (product_id, '10ml', 10.0, 1699.00, 1);
END $$;

-- =============================================
-- INSERT COA REPORTS
-- =============================================

INSERT INTO coa_reports (product_name, batch, test_date, purity_percentage, quantity, task_number, verification_key, image_url, featured)
VALUES
('Tirzepatide 15mg', 'Unknown', '2025-06-20', 99.658, '16.80 mg', '#68396', '9AUYT3EZV9Y9', '/coa/tirzepatide-15mg-coa.jpg', true),
('Tirzepatide 30mg', 'Unknown', '2025-06-19', 99.683, '31.21 mg', '#68397', 'ZW6YWJ55MXK9', '/coa/tirzepatide-30mg-coa.jpg', true);

-- =============================================
-- UPDATE PRODUCT AVAILABILITY BASED ON STOCK
-- =============================================

UPDATE products p
SET available = EXISTS (
  SELECT 1 FROM product_variations pv 
  WHERE pv.product_id = p.id AND pv.stock_quantity > 0
)
WHERE EXISTS (SELECT 1 FROM product_variations pv2 WHERE pv2.product_id = p.id);

-- =============================================
-- END OF SETUP
-- =============================================
