import React, { useEffect, useState } from 'react';
import {
  X,
  Package,
  ShoppingCart,
  Plus,
  Minus,
  Truck,
  ShieldCheck,
  Zap,
  FileText,
} from 'lucide-react';
import type { Product, ProductVariation, GlobalDiscount, ProductBundleTier, Protocol } from '../types';
import { resolveProductPricing, pickBundleTier } from '../utils/pricing';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, variation: ProductVariation | undefined, quantity: number, priceOverride?: number) => void;
  globalDiscount?: GlobalDiscount | null;
  bundleTiers?: ProductBundleTier[];
  protocols?: Protocol[];
  asPage?: boolean;
}

const formatShippingWindow = () => {
  const start = new Date();
  start.setDate(start.getDate() + 5);
  const end = new Date();
  end.setDate(end.getDate() + 11);
  const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
};

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, onAddToCart, globalDiscount, bundleTiers, protocols, asPage = false }) => {
  const getFirstAvailableVariation = () => {
    if (!product.variations || product.variations.length === 0) return undefined;
    const available = product.variations.find(v => v.stock_quantity > 0);
    return available || product.variations[0];
  };

  const [imageError, setImageError] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(
    getFirstAvailableVariation()
  );
  const [quantity, setQuantity] = useState(1);

  // Lock body scroll only when used as overlay
  useEffect(() => {
    if (asPage) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [asPage]);

  const pricing = resolveProductPricing(product, selectedVariation, globalDiscount);
  const unitPrice = pricing.price;
  const baseOriginal = pricing.originalPrice;
  const hasDiscount = pricing.hasDiscount;
  const discountPercent = hasDiscount
    ? Math.round((1 - unitPrice / baseOriginal) * 100)
    : 0;

  const totalPrice = unitPrice * quantity;
  const totalOriginal = baseOriginal * quantity;

  const hasAnyStock = product.variations && product.variations.length > 0
    ? product.variations.some(v => v.stock_quantity > 0)
    : product.stock_quantity > 0;

  const isOutOfStock =
    !product.available ||
    !hasAnyStock ||
    (selectedVariation ? selectedVariation.stock_quantity === 0 : product.stock_quantity === 0);

  const tagPool = [product.cas_number, product.sequence, product.molecular_weight]
    .filter((v): v is string => Boolean(v && v.trim()));
  const tags = tagPool.slice(0, 2);

  const incrementQuantity = () => setQuantity(prev => prev + 1);
  const decrementQuantity = () => setQuantity(prev => prev > 1 ? prev - 1 : 1);

  const handleAddToCart = () => {
    const priceToUse = pricing.hasGlobalDiscount ? unitPrice : undefined;
    onAddToCart(product, selectedVariation, quantity, priceToUse);
    if (!asPage) onClose();
  };

  const sortedTiers = (bundleTiers ?? [])
    .filter((t) => t.active)
    .slice()
    .sort((a, b) => a.min_quantity - b.min_quantity);
  const previewTier = pickBundleTier(sortedTiers, quantity);
  const bundleUnitPrice = previewTier
    ? unitPrice * (1 - Number(previewTier.discount_percentage) / 100)
    : unitPrice;
  const bundleTotal = bundleUnitPrice * quantity;

  const coaUrl = product.coa_url || product.safety_sheet_url || null;

  const formatPrice = (n: number) =>
    `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`;

  const variations = product.variations ?? [];
  const shippingWindow = formatShippingWindow();

  const wrapperClass = asPage
    ? 'w-full flex justify-center px-3 sm:px-4 py-6 sm:py-10'
    : 'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal-900/40 backdrop-blur-sm animate-fadeIn';
  const cardClass = asPage
    ? 'relative w-full sm:max-w-2xl bg-white shadow-luxury rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col'
    : 'relative w-full sm:max-w-2xl bg-white shadow-luxury rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-slideIn';

  return (
    <div
      className={wrapperClass}
      onClick={asPage ? undefined : onClose}
    >
      <div
        className={cardClass}
        onClick={(e) => e.stopPropagation()}
      >
        {!asPage && (
          <div className="flex justify-center pt-2 sm:pt-3 pb-1 flex-shrink-0">
            <span className="block w-10 h-1.5 rounded-full bg-charcoal-200" />
          </div>
        )}

        {!asPage && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-1.5 rounded-full text-charcoal-400 hover:text-brand-600 hover:bg-cream-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Scrollable content */}
        <div className={`px-4 sm:px-5 pt-2 pb-4 flex-1 ${asPage ? '' : 'overflow-y-auto'}`}>
          {/* Hero image card */}
          <div className="rounded-2xl bg-cream-100 border border-charcoal-100 p-6 sm:p-8 flex items-center justify-center aspect-[4/3] sm:aspect-[16/10]">
            {product.image_url && !imageError ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="max-h-full max-w-full object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <Package className="w-16 h-16 text-brand-300" strokeWidth={1.25} />
            )}
          </div>

          {/* Product info card */}
          <div className="mt-4 rounded-2xl bg-white border border-charcoal-100 p-4 sm:p-5">
            {product.category && (
              <p className="font-heading italic text-brand-600 text-sm mb-1">
                {product.category}
              </p>
            )}
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-charcoal-900 tracking-tight">
                {product.name}
              </h2>
              <div className="flex items-baseline gap-2 flex-shrink-0">
                {hasDiscount && (
                  <span className="text-sm text-charcoal-300 line-through">
                    {formatPrice(baseOriginal)}
                  </span>
                )}
                <span className="text-2xl sm:text-3xl font-semibold text-charcoal-900">
                  {formatPrice(unitPrice)}
                </span>
              </div>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1 rounded-full border border-charcoal-200 text-charcoal-700 text-xs sm:text-sm max-w-full truncate"
                    title={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <p className="text-sm sm:text-base text-charcoal-500 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Inclusions (if set product) */}
          {product.inclusions && product.inclusions.length > 0 && (
            <div className="mt-4 rounded-2xl bg-cream-100 border border-charcoal-100 p-4 sm:p-5">
              <p className="text-xs font-semibold tracking-widest text-brand-600 mb-3 uppercase">
                Set Includes
              </p>
              <ul className="space-y-2">
                {product.inclusions.map((item, index) => (
                  <li key={index} className="text-sm text-charcoal-700 flex items-start gap-2">
                    <span className="text-brand-500 font-bold mt-0.5">✓</span>
                    <span className="flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dosage */}
          {variations.length > 0 && (
            <div className="mt-5 flex items-start sm:items-center gap-4 flex-col sm:flex-row">
              <span className="font-semibold text-charcoal-900 text-base w-24 flex-shrink-0">Dosage</span>
              <div className="flex flex-wrap gap-2">
                {variations.map((variation) => {
                  const outOfStock = variation.stock_quantity === 0;
                  const isSelected = selectedVariation?.id === variation.id;
                  return (
                    <button
                      key={variation.id}
                      onClick={() => !outOfStock && setSelectedVariation(variation)}
                      disabled={outOfStock}
                      className={`px-5 py-2 rounded-full border text-sm font-semibold transition-all ${
                        isSelected
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-charcoal-800 border-charcoal-200 hover:border-brand-400 hover:text-brand-600'
                      } ${outOfStock ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                    >
                      {variation.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity + price */}
          <div className="mt-5 flex items-center gap-4">
            <span className="font-semibold text-charcoal-900 text-base w-24 flex-shrink-0">Quantity</span>
            <div className="flex items-center justify-between flex-1 min-w-0">
              <div className="inline-flex items-center rounded-full border border-charcoal-200 bg-white">
                <button
                  onClick={decrementQuantity}
                  aria-label="Decrease quantity"
                  className="w-10 h-10 flex items-center justify-center text-charcoal-700 hover:bg-cream-100 rounded-l-full transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="min-w-[2rem] text-center font-semibold text-charcoal-900">{quantity}</span>
                <button
                  onClick={incrementQuantity}
                  aria-label="Increase quantity"
                  className="w-10 h-10 flex items-center justify-center text-charcoal-700 hover:bg-cream-100 rounded-r-full transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-right">
                {hasDiscount && (
                  <div className="text-xs text-charcoal-300 line-through">
                    {formatPrice(totalOriginal)}
                  </div>
                )}
                <div className="text-2xl sm:text-3xl font-semibold text-charcoal-900">
                  {formatPrice(totalPrice)}
                </div>
                {hasDiscount && (
                  <div className="text-[10px] font-bold text-brand-600">{discountPercent}% OFF</div>
                )}
              </div>
            </div>
          </div>

          {/* Scientific details */}
          {(product.purity_percentage || product.storage_conditions) && (
            <div className="mt-5 rounded-2xl bg-cream-100 border border-charcoal-100 p-4">
              <p className="text-xs font-semibold tracking-widest text-brand-600 mb-3 uppercase">
                Scientific Information
              </p>
              <div className="space-y-1.5 text-sm">
                {product.purity_percentage ? (
                  <div className="flex justify-between">
                    <span className="text-charcoal-500">Purity</span>
                    <span className="font-medium text-charcoal-900">{product.purity_percentage}%</span>
                  </div>
                ) : null}
                {product.storage_conditions && (
                  <div className="flex justify-between">
                    <span className="text-charcoal-500">Storage</span>
                    <span className="font-medium text-charcoal-900">{product.storage_conditions}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-charcoal-500">Stock</span>
                  <span className="font-medium text-charcoal-900">
                    {product.variations && product.variations.length > 0
                      ? product.variations.reduce((sum, v) => sum + v.stock_quantity, 0)
                      : product.stock_quantity} units
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Bundle & Save carousel */}
          {sortedTiers.length > 0 && (() => {
            type Card = { qty: number; percent: number; mostPopular: boolean };
            const cards: Card[] = [
              { qty: 1, percent: 0, mostPopular: false },
              ...sortedTiers.map((t) => ({
                qty: t.min_quantity,
                percent: Number(t.discount_percentage),
                mostPopular: t.most_popular,
              })),
            ];
            return (
              <div className="mt-6">
                <p className="text-xs font-semibold tracking-widest text-charcoal-700 uppercase mb-3">
                  Bundle &amp; Save
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
                  {cards.map((card, i) => {
                    const isSelected = quantity >= card.qty &&
                      (i === cards.length - 1 || quantity < cards[i + 1].qty);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setQuantity(card.qty)}
                        className={`relative flex-shrink-0 snap-start w-44 sm:w-48 rounded-2xl border-2 transition-all p-3 text-left ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50/40'
                            : 'border-charcoal-200 bg-white hover:border-brand-300'
                        }`}
                      >
                        {card.mostPopular && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-brand-600 text-white shadow-sm whitespace-nowrap">
                            Most Popular
                          </span>
                        )}
                        <div className="h-16 sm:h-20 flex items-end justify-center mb-2">
                          {Array.from({ length: Math.min(card.qty, 4) }).map((_, idx) => (
                            <div
                              key={idx}
                              className="-mx-1 w-9 h-16 sm:w-10 sm:h-20 rounded-md overflow-hidden bg-cream-100 border border-charcoal-100 flex items-center justify-center"
                              style={{ zIndex: idx }}
                            >
                              {product.image_url ? (
                                <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-charcoal-300" />
                              )}
                            </div>
                          ))}
                          {card.qty > 4 && (
                            <span className="ml-1 text-[10px] font-semibold text-charcoal-500">+{card.qty - 4}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-bold text-charcoal-900 uppercase tracking-wide">
                            {card.qty} {card.qty === 1 ? 'Vial' : 'Vials'}
                          </span>
                          {card.percent > 0 ? (
                            <span className="text-xs sm:text-sm font-bold text-brand-600">
                              {card.percent}% OFF
                            </span>
                          ) : (
                            <span className="text-[10px] sm:text-xs text-charcoal-400">Base</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {previewTier && (
                  <div className="mt-3 flex items-baseline justify-between text-sm">
                    <span className="text-charcoal-500">Bundle total ({quantity}× at {Number(previewTier.discount_percentage)}% off)</span>
                    <span className="font-bold text-charcoal-900">{formatPrice(bundleTotal)}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Research-only disclaimer */}
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 text-xs sm:text-sm leading-relaxed">
            <p className="font-bold mb-1 uppercase tracking-wide text-[11px]">For Research Purposes Only</p>
            <p>
              This compound is not FDA approved. All data presented is from clinical trials for educational reference.
            </p>
          </div>

          {/* CoA + Add to cart */}
          <div className="mt-5 flex items-center gap-3">
            {coaUrl ? (
              <a
                href={coaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-full border border-charcoal-200 text-charcoal-900 text-sm font-semibold hover:bg-cream-100 hover:border-brand-400 hover:text-brand-600 transition-colors inline-flex items-center gap-1.5 flex-shrink-0"
              >
                <FileText className="w-4 h-4" />
                View COA
              </a>
            ) : (
              <button
                disabled
                className="px-5 py-3 rounded-full border border-charcoal-200 text-charcoal-400 text-sm font-semibold cursor-not-allowed inline-flex items-center gap-1.5 flex-shrink-0"
              >
                <FileText className="w-4 h-4" />
                COA
              </button>
            )}
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="flex-1 py-3 rounded-full bg-brand-500 text-white text-base font-semibold hover:bg-brand-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOutOfStock ? 'Out of Stock' : 'Add to cart'}
              {!isOutOfStock && <ShoppingCart className="w-5 h-5" />}
            </button>
          </div>

          {/* Shipping info */}
          <div className="mt-4 rounded-2xl bg-cream-100 border border-charcoal-100 p-3 grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center gap-1">
              <Truck className="w-5 h-5 text-brand-600" />
              <p className="text-[11px] text-charcoal-700 leading-tight">{shippingWindow}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              <p className="text-[11px] text-charcoal-700 leading-tight">
                <span className="underline decoration-dotted">Free shipment protection</span>
              </p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Zap className="w-5 h-5 text-brand-600" />
              <p className="text-[11px] text-charcoal-700 leading-tight">Overnight shipping available</p>
            </div>
          </div>

          {/* COA inline viewer */}
          {coaUrl && (
            <div className="mt-5 rounded-2xl bg-white border border-charcoal-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-cream-100 border-b border-charcoal-100">
                <p className="text-xs font-semibold tracking-widest text-brand-600 uppercase flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Certificate of Analysis
                </p>
                <a
                  href={coaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Open ↗
                </a>
              </div>
              {/\.pdf(\?.*)?$/i.test(coaUrl) ? (
                <iframe
                  src={coaUrl}
                  title="Certificate of Analysis"
                  className="w-full h-[420px] sm:h-[520px] bg-charcoal-50"
                />
              ) : (
                <img
                  src={coaUrl}
                  alt="Certificate of Analysis"
                  className="w-full max-h-[520px] object-contain bg-charcoal-50"
                />
              )}
            </div>
          )}

          {/* Peptide Protocol */}
          {protocols && protocols.length > 0 && (
            <div className="mt-5 rounded-2xl bg-white border border-charcoal-100 p-4 sm:p-5">
              <p className="text-xs font-semibold tracking-widest text-brand-600 uppercase mb-3">
                Peptide Protocol
              </p>
              <div className="space-y-4">
                {protocols.map((p) => (
                  <div key={p.id} className="border-t first:border-t-0 border-charcoal-100 pt-3 first:pt-0">
                    {p.name && (
                      <p className="font-semibold text-charcoal-900 mb-2">{p.name}</p>
                    )}
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {p.dosage && (
                        <>
                          <dt className="text-charcoal-500">Dosage</dt>
                          <dd className="text-charcoal-900 font-medium">{p.dosage}</dd>
                        </>
                      )}
                      {p.frequency && (
                        <>
                          <dt className="text-charcoal-500">Frequency</dt>
                          <dd className="text-charcoal-900 font-medium">{p.frequency}</dd>
                        </>
                      )}
                      {p.duration && (
                        <>
                          <dt className="text-charcoal-500">Duration</dt>
                          <dd className="text-charcoal-900 font-medium">{p.duration}</dd>
                        </>
                      )}
                      {p.storage && (
                        <>
                          <dt className="text-charcoal-500">Storage</dt>
                          <dd className="text-charcoal-900 font-medium">{p.storage}</dd>
                        </>
                      )}
                    </dl>
                    {p.notes && p.notes.length > 0 && (
                      <ul className="mt-3 space-y-1 list-disc pl-5 text-sm text-charcoal-700">
                        {p.notes.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    )}
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="mt-3 w-full max-h-80 object-contain rounded-lg border border-charcoal-100"
                      />
                    )}
                    {p.file_url && (
                      <a
                        href={p.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
                      >
                        <FileText className="w-4 h-4" />
                        Open full protocol
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment methods */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-charcoal-500">We accept</span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-md bg-charcoal-900 text-white text-[10px] font-bold tracking-tight">Pay</span>
              <span className="px-2 py-1 rounded-md border border-charcoal-200 text-charcoal-700 text-[10px] font-extrabold italic tracking-wide">VISA</span>
              <span className="px-2 py-1 rounded-md border border-charcoal-200 text-charcoal-700 text-[10px] font-bold">GCash</span>
              <span className="px-2 py-1 rounded-md border border-charcoal-200 text-charcoal-700 text-[10px] font-bold">Maya</span>
            </div>
          </div>
        </div>

        {/* Sticky compact action bar */}
        {!asPage && (
        <div
          className="border-t border-charcoal-100 bg-white px-4 sm:px-5 py-3 flex-shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-charcoal-700 truncate pr-2">{product.name}</span>
            <span className="text-base font-semibold text-charcoal-900 flex-shrink-0">
              {formatPrice(unitPrice)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {variations.length > 0 ? (
              <div className="flex items-center gap-2 flex-shrink min-w-0 overflow-x-auto scrollbar-hide">
                {variations.map((variation) => {
                  const outOfStock = variation.stock_quantity === 0;
                  const isSelected = selectedVariation?.id === variation.id;
                  return (
                    <button
                      key={variation.id}
                      onClick={() => !outOfStock && setSelectedVariation(variation)}
                      disabled={outOfStock}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex-shrink-0 ${
                        isSelected
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-charcoal-800 border-charcoal-200'
                      } ${outOfStock ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                    >
                      {variation.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="flex-1 ml-auto py-2.5 rounded-full bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[7rem]"
            >
              {isOutOfStock ? 'Unavailable' : 'Add'}
              {!isOutOfStock && <ShoppingCart className="w-4 h-4" />}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailModal;
