import React, { useEffect, useState } from 'react';
import { Sparkles, Image as ImageIcon, Upload, X } from 'lucide-react';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { useImageUpload } from '../hooks/useImageUpload';

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 100;

const LINK_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'No link' },
  { value: '/', label: 'Shop / Home' },
  { value: '/calculator', label: 'Peptide Calculator' },
  { value: '/peptalk', label: 'Peptalk Articles' },
  { value: '/faq', label: 'FAQ Page' },
  { value: '/coa', label: 'COA Page' },
  { value: '/track-order', label: 'Track Order' },
  { value: 'custom', label: 'Custom URL...' },
];

const isPredefinedLink = (link: string) => LINK_OPTIONS.some(o => o.value === link && o.value !== 'custom');

const PopupManager: React.FC = () => {
  const { siteSettings, loading, updateSiteSettings } = useSiteSettings();
  const { uploadImage, uploading, uploadProgress } = useImageUpload('menu-images');

  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkChoice, setLinkChoice] = useState('none');
  const [customLink, setCustomLink] = useState('');
  const [image, setImage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (!siteSettings) return;
    setEnabled((siteSettings.popup_enabled ?? 'true') !== 'false');
    setTitle(siteSettings.popup_title ?? '');
    setDescription(siteSettings.popup_description ?? '');
    const link = siteSettings.popup_link ?? 'none';
    if (isPredefinedLink(link) || link === 'none') {
      setLinkChoice(link);
      setCustomLink('');
    } else {
      setLinkChoice('custom');
      setCustomLink(link);
    }
    setImage(siteSettings.popup_image ?? '');
  }, [siteSettings]);

  const handleFile = async (file: File) => {
    try {
      const url = await uploadImage(file);
      setImage(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to upload image');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const resolvedLink = linkChoice === 'custom' ? customLink.trim() : linkChoice;
      await updateSiteSettings({
        popup_enabled: enabled ? 'true' : 'false',
        popup_title: title.slice(0, TITLE_MAX),
        popup_description: description.slice(0, DESCRIPTION_MAX),
        popup_link: resolvedLink || 'none',
        popup_image: image,
      });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2200);
    } catch (e) {
      alert('Failed to save popup settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading popup settings...</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-3xl mx-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-brand-500" />
            <h2 className="text-xl font-bold text-gray-900">Popup</h2>
          </div>
          <p className="text-sm text-gray-500">Displayed once on the first page view.</p>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={() => setEnabled(v => !v)}
          aria-pressed={enabled}
          aria-label="Enable popup"
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 ${
            enabled ? 'bg-brand-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Title */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="block text-sm font-bold text-gray-700">Title</label>
            <span className="text-xs text-gray-400">{title.length}/{TITLE_MAX} characters</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            placeholder="Special Welcome Offer"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
          />
        </div>

        {/* Description */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="block text-sm font-bold text-gray-700">Description</label>
            <span className="text-xs text-gray-400">{description.length}/{DESCRIPTION_MAX} characters</span>
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
            placeholder="Get 20% off your first purchase."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
          />
        </div>

        {/* Link to */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Link to</label>
          <select
            value={linkChoice}
            onChange={(e) => setLinkChoice(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
          >
            {LINK_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {linkChoice === 'custom' && (
            <input
              type="url"
              value={customLink}
              onChange={(e) => setCustomLink(e.target.value)}
              placeholder="https://example.com or /product-slug"
              className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
            />
          )}
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Image</label>
          {image ? (
            <div className="relative inline-block">
              <img
                src={image}
                alt="Popup preview"
                className="w-40 h-40 object-cover rounded-xl border border-gray-200"
              />
              <button
                type="button"
                onClick={() => setImage('')}
                className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow"
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all"
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
                  <p className="text-sm text-gray-600">Uploading... {uploadProgress}%</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">Drag a file here or click to select one</p>
                  <p className="text-xs text-gray-400">File should not exceed 10mb. Recommended ratio is 1:1.</p>
                </div>
              )}
            </label>
          )}

          {/* URL fallback */}
          <input
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Or paste an image URL"
            className="mt-3 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
          />
        </div>

        {/* Live Preview */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Preview</label>
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6">
            <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
              {image && (
                <img src={image} alt="" className="w-full h-32 object-cover rounded-xl mb-4" />
              )}
              <h3 className="font-bold text-gray-900 text-lg">{title || 'Special Welcome Offer'}</h3>
              <p className="text-sm text-gray-600 mt-1">{description || 'Get 20% off your first purchase.'}</p>
              <button
                type="button"
                className="mt-4 w-full py-2.5 rounded-full bg-brand-500 text-white text-sm font-semibold"
              >
                {linkChoice !== 'none' ? 'Claim Offer' : 'Got it'}
              </button>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {savedToast && (
            <span className="text-sm text-green-700 font-medium">Saved ✓</span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || uploading}
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Popup'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupManager;
