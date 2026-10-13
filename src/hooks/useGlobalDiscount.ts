import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from '../lib/queryCache';
import type { GlobalDiscount } from '../types';
import { getGlobalDiscountedPrice } from '../utils/pricing';
import {
  mirrorDiscountCreate,
  mirrorDiscountDelete,
  mirrorDiscountSetActive,
  mirrorDiscountUpdate,
} from '../lib/convexMirror';

export function useGlobalDiscount() {
  const [globalDiscount, setGlobalDiscount] = useState<GlobalDiscount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mounted by several components — lib/queryCache makes that one request.
    fetchGlobalDiscount();
  }, []);

  const fetchGlobalDiscount = async () => {
    try {
      setLoading(true);
      const data = await cachedQuery('global_discounts:active', async () => {
        const { data, error } = await supabase
          .from('global_discounts')
          .select('*')
          .eq('active', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as GlobalDiscount[];
      });

      // Date window is checked on every read so a cached list still expires on time.
      const now = new Date();
      const activeDiscount = data.find(discount => {
        if (discount.start_date && new Date(discount.start_date) > now) return false;
        if (discount.end_date && new Date(discount.end_date) < now) return false;
        return true;
      }) ?? null;

      setGlobalDiscount(activeDiscount);
    } catch {
      setGlobalDiscount(null);
    } finally {
      setLoading(false);
    }
  };

  const getDiscountedPrice = (originalPrice: number, productId: string): { price: number; hasGlobalDiscount: boolean } => {
    return getGlobalDiscountedPrice(originalPrice, productId, globalDiscount);
  };

  return {
    globalDiscount,
    loading,
    getDiscountedPrice,
    refreshGlobalDiscount: fetchGlobalDiscount,
  };
}

export function useGlobalDiscountAdmin() {
  const [discounts, setDiscounts] = useState<GlobalDiscount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('global_discounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDiscounts(data as GlobalDiscount[]);
    }
    invalidateCache('global_discounts');
    setLoading(false);
  };

  const saveDiscount = async (discount: Partial<GlobalDiscount>) => {
    try {
      const payload = {
        ...discount,
        updated_at: new Date().toISOString(),
      };

      if (discount.id) {
        const { error } = await supabase
          .from('global_discounts')
          .update(payload)
          .eq('id', discount.id);
        if (error) throw error;
        mirrorDiscountUpdate(discount.id, payload);
      } else {
        const { error } = await supabase
          .from('global_discounts')
          .insert([payload]);
        if (error) throw error;
        mirrorDiscountCreate(payload);
      }

      await fetchAll();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteDiscount = async (id: string) => {
    try {
      const { error } = await supabase
        .from('global_discounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      mirrorDiscountDelete(id);
      await fetchAll();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('global_discounts')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      mirrorDiscountSetActive(id, active);
      await fetchAll();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return {
    discounts,
    loading,
    saveDiscount,
    deleteDiscount,
    toggleActive,
    refresh: fetchAll,
  };
}
