import type { CartItem, GlobalDiscount, Product, ProductBundleTier, ProductVariation } from '../types';

interface DiscountedPriceResult {
  price: number;
  hasDiscount: boolean;
  hasGlobalDiscount: boolean;
  hasIndividualDiscount: boolean;
  originalPrice: number;
}

const getDateBoundary = (value: string | undefined, boundary: 'start' | 'end') => {
  if (!value) return null;

  const datePart = value.slice(0, 10);
  const timePart = boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999';
  const parsed = new Date(`${datePart}${timePart}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isGlobalDiscountActive = (globalDiscount?: GlobalDiscount | null) => {
  if (!globalDiscount?.active) return false;

  const now = new Date();
  const startDate = getDateBoundary(globalDiscount.start_date, 'start');
  const endDate = getDateBoundary(globalDiscount.end_date, 'end');

  if (startDate && startDate > now) return false;
  if (endDate && endDate < now) return false;

  return true;
};

export const getGlobalDiscountedPrice = (
  originalPrice: number,
  productId: string,
  globalDiscount?: GlobalDiscount | null
): { price: number; hasGlobalDiscount: boolean } => {
  if (!isGlobalDiscountActive(globalDiscount)) {
    return { price: originalPrice, hasGlobalDiscount: false };
  }

  if (globalDiscount.excluded_product_ids?.includes(productId)) {
    return { price: originalPrice, hasGlobalDiscount: false };
  }

  const discountedPrice = globalDiscount.discount_type === 'percentage'
    ? originalPrice * (1 - globalDiscount.discount_value / 100)
    : Math.max(0, originalPrice - globalDiscount.discount_value);

  return { price: Math.round(discountedPrice), hasGlobalDiscount: discountedPrice < originalPrice };
};

export const resolveProductPricing = (
  product: Product,
  variation?: ProductVariation,
  globalDiscount?: GlobalDiscount | null
): DiscountedPriceResult => {
  const originalPrice = variation?.price ?? product.base_price;
  const individualPrice = variation
    ? (variation.discount_active && variation.discount_price !== null ? variation.discount_price : variation.price)
    : (product.discount_active && product.discount_price !== null ? product.discount_price : product.base_price);

  const hasIndividualDiscount = individualPrice < originalPrice;
  const globalResult = getGlobalDiscountedPrice(originalPrice, product.id, globalDiscount);

  if (globalResult.hasGlobalDiscount && (!hasIndividualDiscount || globalResult.price < individualPrice)) {
    return {
      price: globalResult.price,
      hasDiscount: true,
      hasGlobalDiscount: true,
      hasIndividualDiscount,
      originalPrice,
    };
  }

  return {
    price: individualPrice,
    hasDiscount: hasIndividualDiscount,
    hasGlobalDiscount: false,
    hasIndividualDiscount,
    originalPrice,
  };
};

// ----- Bundle (per-product quantity) discount logic -----

export type BundleTiersMap = Record<string, ProductBundleTier[]>;

export interface PricedLine {
  index: number;
  unitBasePrice: number;
  bundlePercent: number;
  unitFinalPrice: number;
  lineSubtotal: number;
  lineSavings: number;
  appliedTier: ProductBundleTier | null;
}

export interface CartPricing {
  lines: PricedLine[];
  subtotalBeforeBundle: number;
  bundleSavings: number;
  subtotal: number;
  hasBundleDiscount: boolean;
}

export const getCartItemUnitBasePrice = (
  item: CartItem,
  globalDiscount?: GlobalDiscount | null
): number => {
  return resolveProductPricing(item.product, item.variation, globalDiscount).price;
};

export const pickBundleTier = (
  tiers: ProductBundleTier[] | undefined,
  quantity: number
): ProductBundleTier | null => {
  if (!tiers || tiers.length === 0) return null;
  return tiers
    .filter((t) => t.active && quantity >= t.min_quantity)
    .sort((a, b) => b.min_quantity - a.min_quantity)[0] ?? null;
};

export const computeCartPricing = (
  items: CartItem[],
  tiersByProduct: BundleTiersMap,
  globalDiscount?: GlobalDiscount | null
): CartPricing => {
  const lines: PricedLine[] = items.map((item, index) => {
    const unitBasePrice = getCartItemUnitBasePrice(item, globalDiscount);
    const tier = pickBundleTier(tiersByProduct[item.product.id], item.quantity);
    const bundlePercent = tier ? Number(tier.discount_percentage) : 0;
    const unitFinalPrice = unitBasePrice * (1 - bundlePercent / 100);
    const lineSubtotal = unitFinalPrice * item.quantity;
    const lineSavings = (unitBasePrice - unitFinalPrice) * item.quantity;
    return {
      index,
      unitBasePrice,
      bundlePercent,
      unitFinalPrice,
      lineSubtotal,
      lineSavings,
      appliedTier: tier,
    };
  });

  const subtotalBeforeBundle = items.reduce(
    (sum, item, i) => sum + lines[i].unitBasePrice * item.quantity,
    0
  );
  const bundleSavings = lines.reduce((sum, l) => sum + l.lineSavings, 0);
  const subtotal = subtotalBeforeBundle - bundleSavings;
  return {
    lines,
    subtotalBeforeBundle,
    bundleSavings,
    subtotal,
    hasBundleDiscount: bundleSavings > 0,
  };
};
