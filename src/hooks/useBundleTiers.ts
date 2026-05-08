import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ProductBundleTier } from '../types';
import type { BundleTiersMap } from '../utils/pricing';

export function useBundleTiers(productIds?: string[]) {
  const [tiersByProduct, setTiersByProduct] = useState<BundleTiersMap>({});
  const [loading, setLoading] = useState(true);

  const fetchTiers = useCallback(async (ids?: string[]) => {
    setLoading(true);
    let query = supabase
      .from('product_bundle_tiers')
      .select('*')
      .eq('active', true)
      .order('min_quantity', { ascending: true });

    if (ids && ids.length > 0) {
      query = query.in('product_id', ids);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to load bundle tiers:', error);
      setTiersByProduct({});
    } else {
      const map: BundleTiersMap = {};
      (data as ProductBundleTier[]).forEach((tier) => {
        if (!map[tier.product_id]) map[tier.product_id] = [];
        map[tier.product_id].push(tier);
      });
      setTiersByProduct(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTiers(productIds);
  }, [fetchTiers, productIds?.join(',')]);

  return { tiersByProduct, loading, refresh: () => fetchTiers(productIds) };
}

export async function fetchBundleTiersForProduct(
  productId: string
): Promise<ProductBundleTier[]> {
  const { data, error } = await supabase
    .from('product_bundle_tiers')
    .select('*')
    .eq('product_id', productId)
    .eq('active', true)
    .order('min_quantity', { ascending: true });
  if (error) {
    console.error('Failed to load tiers for product:', error);
    return [];
  }
  return (data as ProductBundleTier[]) ?? [];
}
