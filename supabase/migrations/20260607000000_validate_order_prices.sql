-- =============================================
-- SERVER-SIDE PRICE VALIDATION AT CHECKOUT
-- =============================================
-- Orders are inserted directly from the browser with the anon key, and every
-- price (item unit price, bundle discount, promo, order total) is computed
-- client-side. A stale cart (e.g. opened during a sale that has since ended) or
-- a tampered client could therefore submit prices lower than the current,
-- authoritative ones and check out at a discount that no longer applies.
--
-- This trigger recomputes the authoritative price for every line server-side,
-- straight from the products / variations / discounts / bundle / promo tables,
-- and REJECTS the insert when the submitted amounts are lower than they should
-- be. Because PayMongo derives its charge amount from orders.total_price (read
-- after this trigger runs) and manual orders store the same field, this single
-- guard protects both checkout paths.
--
-- A 1-day grace window is applied to every discount date boundary so timezone /
-- end-of-day differences between the browser and the database can never reject a
-- legitimate order placed near the edge of a sale; carts left over from a sale
-- that ended days/weeks ago (the reported issue) are still caught.

-- Mirrors src/utils/pricing.ts resolveProductPricing(): returns the unit price
-- for a line BEFORE any per-quantity bundle discount, honoring date-gated
-- individual discounts and the active site-wide global discount.
CREATE OR REPLACE FUNCTION get_authoritative_unit_base_price(
  p_product_id UUID,
  p_variation_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
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
    RETURN NULL; -- product was deleted
  END IF;

  IF p_variation_id IS NOT NULL THEN
    SELECT price, discount_price, discount_active
      INTO v_var_price, v_var_disc_price, v_var_disc_active
    FROM product_variations WHERE id = p_variation_id;
    IF NOT FOUND THEN
      RETURN NULL; -- variation was removed
    END IF;
    v_original := v_var_price;
    -- Variations carry no date columns; gate on the flag only (matches client).
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

  -- Most recent active global discount whose window (with grace) contains now().
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

  -- Global wins only when it is cheaper than (or replaces) the individual price.
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
  -- Tolerances absorb float rounding between JS and Postgres.
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

    -- Highest applicable active bundle tier for this quantity.
    SELECT discount_percentage INTO v_bundle_pct
    FROM product_bundle_tiers
    WHERE product_id = v_product_id
      AND active = true
      AND min_quantity <= v_quantity
    ORDER BY min_quantity DESC
    LIMIT 1;
    v_bundle_pct := COALESCE(v_bundle_pct, 0);

    v_unit_final := v_unit_base * (1 - v_bundle_pct / 100.0);

    -- Only block UNDERpayment; a customer paying at/above the current price is fine.
    IF v_submitted < v_unit_final - c_unit_tol THEN
      RAISE EXCEPTION 'PRICE_CHANGED: The price for % has changed (now %, you have %). Please refresh your cart and try again.',
        v_name, round(v_unit_final, 2), round(v_submitted, 2);
    END IF;

    v_auth_subtotal := v_auth_subtotal + v_unit_final * v_quantity;
  END LOOP;

  -- Recompute the promo discount server-side so a fabricated/expired promo can't
  -- be used to drive the total below the authoritative amount.
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

-- BEFORE INSERT, alongside the existing stock-decrement trigger. Either trigger
-- raising aborts the whole insert atomically, so ordering does not matter.
DROP TRIGGER IF EXISTS trigger_validate_order_prices ON orders;
CREATE TRIGGER trigger_validate_order_prices
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION validate_order_prices();
