import React, { useEffect, useState } from 'react';
import { Mail, X, Sparkles, Check, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { trackEvent, identifyUser } from '../utils/analytics';

const POPUP_DISMISSED_KEY = 'sldp_promo_popup_dismissed_at';
const SUBSCRIBED_KEY = 'sldp_promo_subscribed';
const POPUP_DELAY_MS = 8000;
const POPUP_COOLDOWN_DAYS = 7;

type Status = 'idle' | 'submitting' | 'success' | 'error';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

async function saveSubscriber(email: string, source: 'banner' | 'popup'): Promise<string | null> {
  const trimmed = email.trim().toLowerCase();
  const { error } = await supabase
    .from('subscribers')
    .insert([{ email: trimmed, source }]);
  if (error) {
    if (error.code === '23505') return null;
    return error.message;
  }
  return null;
}

const PromoSignup: React.FC = () => {
  const [bannerVisible, setBannerVisible] = useState(true);
  const [popupVisible, setPopupVisible] = useState(false);
  const [bannerEmail, setBannerEmail] = useState('');
  const [popupEmail, setPopupEmail] = useState('');
  const [bannerStatus, setBannerStatus] = useState<Status>('idle');
  const [popupStatus, setPopupStatus] = useState<Status>('idle');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [popupError, setPopupError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const t = window.setTimeout(() => {
      setPopupVisible(true);
      trackEvent('promo_popup_shown', {});
    }, POPUP_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const dismissPopup = () => {
    setPopupVisible(false);
    trackEvent('promo_popup_dismissed', {});
  };

  const submitBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerError(null);
    trackEvent('promo_subscribe_clicked', { source: 'banner' });
    if (!isValidEmail(bannerEmail)) {
      setBannerError('Please enter a valid email.');
      trackEvent('promo_subscribe_invalid_email', { source: 'banner' });
      return;
    }
    setBannerStatus('submitting');
    const err = await saveSubscriber(bannerEmail, 'banner');
    if (err) {
      setBannerStatus('error');
      setBannerError(err);
      trackEvent('promo_subscribe_failed', { source: 'banner', message: err });
      return;
    }
    setBannerStatus('success');
    if (typeof window !== 'undefined') localStorage.setItem(SUBSCRIBED_KEY, '1');
    identifyUser(bannerEmail, { source: 'banner' });
    trackEvent('promo_subscribed', { source: 'banner', email: bannerEmail.trim().toLowerCase() });
  };

  const submitPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setPopupError(null);
    trackEvent('promo_subscribe_clicked', { source: 'popup' });
    if (!isValidEmail(popupEmail)) {
      setPopupError('Please enter a valid email.');
      trackEvent('promo_subscribe_invalid_email', { source: 'popup' });
      return;
    }
    setPopupStatus('submitting');
    const err = await saveSubscriber(popupEmail, 'popup');
    if (err) {
      setPopupStatus('error');
      setPopupError(err);
      trackEvent('promo_subscribe_failed', { source: 'popup', message: err });
      return;
    }
    setPopupStatus('success');
    if (typeof window !== 'undefined') localStorage.setItem(SUBSCRIBED_KEY, '1');
    identifyUser(popupEmail, { source: 'popup' });
    trackEvent('promo_subscribed', { source: 'popup', email: popupEmail.trim().toLowerCase() });
    window.setTimeout(() => setPopupVisible(false), 1800);
  };

  return (
    <>
      {bannerVisible && (
        <div className="relative bg-white border-b border-charcoal-100">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent" />
          <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] uppercase tracking-[0.18em] font-bold border border-brand-100">
                <Sparkles className="w-3 h-3" /> Subscribe
              </span>
              <span className="text-charcoal-600 text-xs sm:text-sm font-medium truncate">
                <span className="hidden sm:inline">Subscribe for future promos, restocks & member-only drops.</span>
                <span className="sm:hidden">Subscribe for future promos.</span>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[220px] sm:min-w-[300px] max-w-md">
              {bannerStatus === 'success' ? (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-brand-700 font-semibold">
                  <span className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                  You're in. Check your inbox.
                </div>
              ) : (
                <form onSubmit={submitBanner} className="flex-1 flex items-center">
                  <div className="relative flex-1 flex items-center bg-cream-100 border border-charcoal-100 hover:border-brand-300 focus-within:border-brand-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100 rounded-full transition-all duration-200 group">
                    <Mail className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 group-focus-within:text-brand-500 transition-colors" />
                    <input
                      type="email"
                      value={bannerEmail}
                      onChange={e => setBannerEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-9 pr-1 py-1.5 text-xs sm:text-sm bg-transparent text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none"
                      aria-label="Email for promo updates"
                      required
                    />
                    <button
                      type="submit"
                      disabled={bannerStatus === 'submitting'}
                      className="m-0.5 inline-flex items-center gap-1 px-3.5 py-1 text-xs sm:text-sm font-semibold rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60 transition-all duration-200 shrink-0 shadow-soft"
                    >
                      {bannerStatus === 'submitting' ? '...' : (
                        <>
                          Join
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
              <button
                onClick={() => { setBannerVisible(false); trackEvent('promo_banner_dismissed', {}); }}
                className="text-charcoal-300 hover:text-charcoal-700 p-1 transition-colors shrink-0"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bannerError && (
              <span className="w-full text-[11px] text-red-600 text-center sm:text-right">{bannerError}</span>
            )}
          </div>
        </div>
      )}

      {popupVisible && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal-900/40 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative bg-white rounded-3xl shadow-luxury max-w-md w-full overflow-hidden animate-fadeIn">
            {/* Decorative gradient accents */}
            <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-brand-100/60 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-cream-200/80 blur-3xl pointer-events-none" />

            <button
              onClick={dismissPopup}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/80 backdrop-blur hover:bg-cream-100 text-charcoal-400 hover:text-charcoal-900 transition-all z-20 border border-charcoal-100"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative px-7 pt-10 pb-7">
              {/* Eyebrow tag */}
              <div className="flex justify-center mb-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-[10px] uppercase tracking-[0.22em] font-bold text-brand-700">
                  <Sparkles className="w-3 h-3" />
                  Members Only
                </span>
              </div>

              {/* Editorial heading */}
              <div className="text-center mb-2">
                <h3 className="font-heading font-bold text-charcoal-900 leading-[1.05] tracking-tight">
                  <span className="block text-3xl sm:text-4xl">Get</span>
                  <span className="block text-5xl sm:text-6xl bg-gradient-to-br from-brand-500 to-brand-700 bg-clip-text text-transparent my-1">
                    10% Off
                  </span>
                  <span className="block text-xl sm:text-2xl text-charcoal-700 font-normal italic">
                    your first order
                  </span>
                </h3>
              </div>

              <p className="text-center text-sm text-charcoal-500 mt-4 mb-6 max-w-xs mx-auto leading-relaxed">
                Join the SlimDose list for exclusive promo codes, restocks, and member-only deals.
              </p>

              {popupStatus === 'success' ? (
                <div className="text-center py-2">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-brand-500 flex items-center justify-center shadow-luxury">
                    <Check className="w-7 h-7 text-white" strokeWidth={2.5} />
                  </div>
                  <p className="font-heading font-bold text-xl text-charcoal-900">You're subscribed.</p>
                  <p className="text-sm text-charcoal-500 mt-1">Your promo code is on its way.</p>
                </div>
              ) : (
                <form onSubmit={submitPopup} className="space-y-3">
                  <div className="relative flex items-center bg-white border border-charcoal-100 hover:border-brand-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100 rounded-full transition-all duration-200 shadow-soft">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400" />
                    <input
                      type="email"
                      value={popupEmail}
                      onChange={e => setPopupEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-11 pr-3 py-3.5 bg-transparent text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none rounded-full"
                      required
                    />
                  </div>

                  {popupError && (
                    <p className="text-sm text-red-600 text-center">{popupError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={popupStatus === 'submitting'}
                    className="group w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full bg-charcoal-900 hover:bg-brand-600 text-white font-semibold disabled:opacity-60 transition-all duration-300 shadow-luxury hover:shadow-hover"
                  >
                    {popupStatus === 'submitting' ? 'Subscribing...' : (
                      <>
                        Claim My 10% Off
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={dismissPopup}
                    className="w-full text-xs text-charcoal-400 hover:text-charcoal-700 transition-colors pt-1"
                  >
                    No thanks, I'll pay full price
                  </button>
                </form>
              )}

              <p className="text-center text-[10px] uppercase tracking-[0.18em] text-charcoal-300 font-semibold mt-6 pt-5 border-t border-charcoal-100">
                No spam · Unsubscribe anytime
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PromoSignup;
