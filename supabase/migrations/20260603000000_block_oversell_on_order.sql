-- =============================================
-- PREVENT OVERSELLING (reject orders for out-of-stock / insufficient stock items)
-- =============================================
-- Previously the stock-decrement trigger subtracted blindly, letting stock go
-- negative — so sold-out items could still be ordered. This version checks the
-- available stock first and raises an error (rejecting the INSERT) when there
-- isn't enough, while still decrementing on success.

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
