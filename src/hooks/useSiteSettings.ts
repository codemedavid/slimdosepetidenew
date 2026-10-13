import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { cachedQuery } from '../lib/queryCache';
import { SiteSettings, SiteSetting } from '../types';
import { mirrorSiteSettingUpsert, mirrorSiteSettingsUpsertMany } from '../lib/convexMirror';

export const useSiteSettings = () => {
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSiteSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const settingsData = await cachedQuery('site_settings', async () => {
        const { data, error } = await supabase
          .from('site_settings')
          .select('*')
          .order('id');
        if (error) throw error;
        return (data || []) as SiteSetting[];
      });

      // Transform the data into a more usable format
      const settings: SiteSettings = {
        site_name: settingsData.find(s => s.id === 'site_name')?.value || 'SlimDose Peptides',
        site_logo: settingsData.find(s => s.id === 'site_logo')?.value || '/assets/logo.jpeg',
        site_description: settingsData.find(s => s.id === 'site_description')?.value || '',
        currency: settingsData.find(s => s.id === 'currency')?.value || 'PHP',
        currency_code: settingsData.find(s => s.id === 'currency_code')?.value || 'PHP',
        hero_badge_text: settingsData.find(s => s.id === 'hero_badge_text')?.value || 'Premium Peptide Solutions',
        hero_title_prefix: settingsData.find(s => s.id === 'hero_title_prefix')?.value || 'Premium',
        hero_title_highlight: settingsData.find(s => s.id === 'hero_title_highlight')?.value || 'Peptides',
        hero_title_suffix: settingsData.find(s => s.id === 'hero_title_suffix')?.value || '& Essentials',
        hero_subtext: settingsData.find(s => s.id === 'hero_subtext')?.value || 'From the Lab to You — Simplifying Science, One Dose at a Time.',
        hero_tagline: settingsData.find(s => s.id === 'hero_tagline')?.value || 'Quality-tested products. Reliable performance. Trusted by our community.',
        hero_description: settingsData.find(s => s.id === 'hero_description')?.value || 'SlimDose Peptides is your all-in-one destination for high-quality peptides, peptide pens, and the essential accessories you need for a smooth and confident wellness routine.',
        hero_accent_color: settingsData.find(s => s.id === 'hero_accent_color')?.value || 'gold-500',
        popup_enabled: settingsData.find(s => s.id === 'popup_enabled')?.value || 'true',
        popup_title: settingsData.find(s => s.id === 'popup_title')?.value || '',
        popup_description: settingsData.find(s => s.id === 'popup_description')?.value || '',
        popup_link: settingsData.find(s => s.id === 'popup_link')?.value || 'none',
        popup_image: settingsData.find(s => s.id === 'popup_image')?.value || ''
      };

      setSiteSettings(settings);
    } catch (err) {
      console.error('Error fetching site settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch site settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSiteSetting = async (id: string, value: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('site_settings')
        .update({ value })
        .eq('id', id);

      if (error) throw error;

      mirrorSiteSettingUpsert(id, value);

      // Refresh the settings
      await fetchSiteSettings();
    } catch (err) {
      console.error('Error updating site setting:', err);
      setError(err instanceof Error ? err.message : 'Failed to update site setting');
      throw err;
    }
  };

  const updateSiteSettings = async (updates: Partial<SiteSettings>) => {
    try {
      setError(null);

      const upsertData = Object.entries(updates).map(([key, value]) => ({
        id: key,
        value: String(value),
        type: 'string', // Default type
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('site_settings')
        .upsert(upsertData);

      if (error) throw error;

      mirrorSiteSettingsUpsertMany(
        upsertData.map((d) => ({ id: d.id, value: d.value, type: d.type })),
      );

      // Refresh the settings
      await fetchSiteSettings();
    } catch (err) {
      console.error('Error updating site settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update site settings');
      throw err;
    }
  };

  useEffect(() => {
    fetchSiteSettings();
  }, []);

  return {
    siteSettings,
    loading,
    error,
    updateSiteSetting,
    updateSiteSettings,
    refetch: fetchSiteSettings
  };
};
