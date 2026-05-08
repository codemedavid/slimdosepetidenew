import { useState, useEffect, useRef, useCallback } from 'react';
import type { CartItem, Product, ProductVariation } from '../types';
import { supabase } from '../lib/supabase';
import { getCartItemUnitBasePrice } from '../utils/pricing';

const STORAGE_KEY = 'peptide_cart';
const PRODUCT_COLUMNS =
  'id, name, slug, description, category, base_price, discount_price, discount_start_date, discount_end_date, discount_active, purity_percentage, molecular_weight, cas_number, sequence, storage_conditions, inclusions, stock_quantity, available, featured, image_url, safety_sheet_url, coa_url, created_at, updated_at';

interface PersistedCartItem {
  product_id: string;
  variation_id: string | null;
  quantity: number;
}

const persist = (items: CartItem[]) => {
  const slim: PersistedCartItem[] = items.map((i) => ({
    product_id: i.product.id,
    variation_id: i.variation?.id ?? null,
    quantity: i.quantity,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
};

const loadPersistedIds = (): PersistedCartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Support old format that stored full CartItem objects
    return parsed
      .map((entry: any): PersistedCartItem | null => {
        if (entry?.product_id) {
          return {
            product_id: entry.product_id,
            variation_id: entry.variation_id ?? null,
            quantity: Number(entry.quantity) || 0,
          };
        }
        if (entry?.product?.id) {
          return {
            product_id: entry.product.id,
            variation_id: entry.variation?.id ?? null,
            quantity: Number(entry.quantity) || 0,
          };
        }
        return null;
      })
      .filter((x): x is PersistedCartItem => !!x && x.quantity > 0);
  } catch (err) {
    console.error('Failed to load cart from storage:', err);
    return [];
  }
};

async function hydrateItems(persisted: PersistedCartItem[]): Promise<CartItem[]> {
  if (persisted.length === 0) return [];
  const productIds = Array.from(new Set(persisted.map((p) => p.product_id)));

  const { data: products, error: productsErr } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .in('id', productIds);
  if (productsErr) {
    console.error('Failed to fetch products for cart hydration:', productsErr);
    return [];
  }

  const variationIds = persisted
    .map((p) => p.variation_id)
    .filter((v): v is string => !!v);
  let variations: ProductVariation[] = [];
  if (variationIds.length > 0) {
    const { data: vData, error: vErr } = await supabase
      .from('product_variations')
      .select('*')
      .in('id', variationIds);
    if (vErr) {
      console.error('Failed to fetch variations for cart hydration:', vErr);
    } else {
      variations = (vData as ProductVariation[]) ?? [];
    }
  }

  const productMap = new Map<string, Product>();
  (products as Product[]).forEach((p) => productMap.set(p.id, p));
  const variationMap = new Map<string, ProductVariation>();
  variations.forEach((v) => variationMap.set(v.id, v));

  const hydrated: CartItem[] = [];
  for (const entry of persisted) {
    const product = productMap.get(entry.product_id);
    if (!product) continue; // product was deleted
    const variation = entry.variation_id ? variationMap.get(entry.variation_id) : undefined;
    if (entry.variation_id && !variation) continue; // variation removed
    const item: CartItem = {
      product,
      variation,
      quantity: entry.quantity,
      price: 0,
    };
    item.price = getCartItemUnitBasePrice(item);
    hydrated.push(item);
  }
  return hydrated;
}

export function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState<number | null>(null);
  const isInitialMountRef = useRef(true);

  // Initial hydrate from DB using persisted ids
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persisted = loadPersistedIds();
      const items = await hydrateItems(persisted);
      if (!cancelled) {
        setCartItems(items);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on changes (skip until first hydration done)
  useEffect(() => {
    if (!hydrated) return;
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
    }
    persist(cartItems);
  }, [cartItems, hydrated]);

  // Listen for addToCart events from other components
  useEffect(() => {
    const handleAddToCartEvent = (e: CustomEvent) => {
      const { product, variation, quantity = 1 } = e.detail;
      const productData: Product = {
        ...product,
        slug: product.slug ?? '',
        coa_url: product.coa_url ?? null,
        stock_quantity: product.stock_quantity ?? 999,
        purity_percentage: product.purity_percentage ?? 0,
        category: product.category ?? '',
        description: product.description ?? '',
        available: product.available ?? true,
        featured: product.featured ?? false,
        storage_conditions: product.storage_conditions ?? '',
        molecular_weight: product.molecular_weight ?? null,
        cas_number: product.cas_number ?? null,
        sequence: product.sequence ?? null,
        inclusions: product.inclusions ?? null,
        safety_sheet_url: product.safety_sheet_url ?? null,
        discount_start_date: product.discount_start_date ?? null,
        discount_end_date: product.discount_end_date ?? null,
        created_at: product.created_at ?? new Date().toISOString(),
        updated_at: product.updated_at ?? new Date().toISOString(),
      };
      const variationData = variation
        ? { ...variation, stock_quantity: variation.stock_quantity ?? 999 }
        : undefined;

      setCartItems((prev) => {
        const existingIndex = prev.findIndex(
          (item) =>
            item.product.id === productData.id &&
            (variationData ? item.variation?.id === variationData.id : !item.variation)
        );
        if (existingIndex > -1) {
          const updated = [...prev];
          updated[existingIndex].quantity += quantity;
          return updated;
        }
        const newItem: CartItem = {
          product: productData,
          variation: variationData,
          quantity,
          price: 0,
        };
        newItem.price = getCartItemUnitBasePrice(newItem);
        return [...prev, newItem];
      });
    };

    window.addEventListener('addToCart', handleAddToCartEvent as EventListener);
    return () => window.removeEventListener('addToCart', handleAddToCartEvent as EventListener);
  }, []);

  const addToCart = (
    product: Product,
    variation?: ProductVariation,
    quantity: number = 1
  ) => {
    const availableStock = variation ? variation.stock_quantity : product.stock_quantity;
    if (availableStock === 0) {
      alert(
        `Sorry, ${product.name}${variation ? ` ${variation.name}` : ''} is out of stock.`
      );
      return;
    }

    const existingItemIndex = cartItems.findIndex(
      (item) =>
        item.product.id === product.id &&
        (variation ? item.variation?.id === variation.id : !item.variation)
    );

    if (existingItemIndex > -1) {
      const currentQuantity = cartItems[existingItemIndex].quantity;
      const newQuantity = currentQuantity + quantity;
      if (newQuantity > availableStock) {
        const remainingStock = availableStock - currentQuantity;
        if (remainingStock > 0) {
          alert(
            `Only ${remainingStock} item(s) available in stock. Added ${remainingStock} to your cart.`
          );
          quantity = remainingStock;
        } else {
          alert(
            `Sorry, you already have the maximum available quantity (${currentQuantity}) in your cart.`
          );
          return;
        }
      }
      const updated = [...cartItems];
      updated[existingItemIndex].quantity += quantity;
      setCartItems(updated);
    } else {
      if (quantity > availableStock) {
        alert(`Only ${availableStock} item(s) available in stock. Added ${availableStock} to your cart.`);
        quantity = availableStock;
      }
      const newItem: CartItem = {
        product,
        variation,
        quantity,
        price: 0,
      };
      newItem.price = getCartItemUnitBasePrice(newItem);
      setCartItems([...cartItems, newItem]);
    }
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }
    const item = cartItems[index];
    const availableStock = item.variation
      ? item.variation.stock_quantity
      : item.product.stock_quantity;
    if (quantity > availableStock) {
      alert(`Only ${availableStock} item(s) available in stock.`);
      quantity = availableStock;
    }
    const updated = [...cartItems];
    updated[index].quantity = quantity;
    setCartItems(updated);
  };

  const removeFromCart = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const getTotalPrice = () =>
    cartItems.reduce((total, item) => total + getCartItemUnitBasePrice(item) * item.quantity, 0);

  const getTotalItems = () =>
    cartItems.reduce((total, item) => total + item.quantity, 0);

  /**
   * Re-fetch latest products & variations for everything in the cart.
   * Returns true if any unit price changed compared to current cart state.
   */
  const refreshCartPrices = useCallback(async (): Promise<boolean> => {
    if (cartItems.length === 0) return false;

    const before = new Map<string, number>();
    cartItems.forEach((item, idx) => {
      before.set(`${idx}`, getCartItemUnitBasePrice(item));
    });

    const persisted: PersistedCartItem[] = cartItems.map((i) => ({
      product_id: i.product.id,
      variation_id: i.variation?.id ?? null,
      quantity: i.quantity,
    }));
    const fresh = await hydrateItems(persisted);

    let changed = fresh.length !== cartItems.length;
    if (!changed) {
      for (let i = 0; i < fresh.length; i++) {
        const newPrice = getCartItemUnitBasePrice(fresh[i]);
        const oldPrice = before.get(`${i}`) ?? 0;
        if (Math.abs(newPrice - oldPrice) > 0.001) {
          changed = true;
          break;
        }
      }
    }

    setCartItems(fresh);
    if (changed) setPricesUpdatedAt(Date.now());
    return changed;
  }, [cartItems]);

  const dismissPriceUpdateNotice = () => setPricesUpdatedAt(null);

  return {
    cartItems,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalPrice,
    getTotalItems,
    refreshCartPrices,
    pricesUpdatedAt,
    dismissPriceUpdateNotice,
  };
}
