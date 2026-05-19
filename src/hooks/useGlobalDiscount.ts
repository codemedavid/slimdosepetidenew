import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
    fetchGlobalDiscount();

    const channelName = `global-discounts-realtime-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_discounts' },
        () => fetchGlobalDiscount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchGlobalDiscount = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('global_discounts')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) {
        // Table may not exist yet — fail silently
        setGlobalDiscount(null);
        return;
      }

      const now = new Date();
      const activeDiscount = (data as GlobalDiscount[] | null)?.find(discount => {
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
