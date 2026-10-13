import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { cachedQuery } from '../lib/queryCache';

export const useCOAPageSetting = () => {
  const [coaPageEnabled, setCoaPageEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mounted in the header, footer and COA page — lib/queryCache makes that one request.
    fetchCOAPageSetting();
  }, []);

  const fetchCOAPageSetting = async () => {
    try {
      setLoading(true);
      const enabled = await cachedQuery('setting:coa_page_enabled', async () => {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'coa_page_enabled')
          .maybeSingle();
        if (error) throw error;
        // Default to enabled if setting doesn't exist
        return data?.value === 'true' || !data;
      });
      setCoaPageEnabled(enabled);
    } catch (error) {
      console.error('Error fetching COA page setting:', error);
      // Default to enabled on error
      setCoaPageEnabled(true);
    } finally {
      setLoading(false);
    }
  };

  return { coaPageEnabled, loading };
};

