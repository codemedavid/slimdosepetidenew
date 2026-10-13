import React, { useState } from 'react';
import { Package } from 'lucide-react';
import type { Product, ProductVariation, GlobalDiscount } from '../types';
import { resolveProductPricing } from '../utils/pricing';
import { optimizedImageUrl } from '../lib/imagekit';

interface MenuItemCardProps {
  product: Product;
  onAddToCart: (product: Product, variation?: ProductVariation, quantity?: number, priceOverride?: number) => void;
  cartQuantity?: number;
  onUpdateQuantity?: (index: number, quantity: number) => void;
  onProductClick?: (product: Product) => void;
  globalDiscount?: GlobalDiscount | null;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({
  product,
  cartQuantity = 0,
  onProductClick,
  globalDiscount,
}) => {
  const [imageError, setImageError] = useState(false);

  const firstAvailableVariation = product.variations && product.variations.length > 0
    ? (product.variations.find(v => v.stock_quantity > 0) || product.variations[0])
    : undefined;

  const pricing = resolveProductPricing(product, firstAvailableVariation, globalDiscount);
  const currentPrice = pricing.price;
  const hasDiscount = pricing.hasDiscount;
  const originalPrice = pricing.originalPrice;
  const hasMultipleVariations = (product.variations?.length ?? 0) > 1;

  const hasAnyStock = product.variations && product.variations.length > 0
    ? product.variations.some(v => v.stock_quantity > 0)
    : product.stock_quantity > 0;

  const isUnavailable = !product.available || !hasAnyStock;

  const handleClick = () => onProductClick?.(product);

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-2xl shadow-soft hover:shadow-luxury transition-all duration-300 h-full flex flex-col group cursor-pointer overflow-hidden border border-charcoal-100"
    >
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-cream-100">
        {product.image_url && !imageError ? (
          <img
            src={optimizedImageUrl(product.image_url, 320)}
            loading="lazy"
            decoding="async"
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-charcoal-300 bg-cream-100">
            <Package className="w-14 h-14" strokeWidth={1.25} />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none">
          {product.featured && (
            <span
              className="px-2.5 py-1 text-white text-[10px] font-semibold uppercase tracking-wider rounded-full shadow-sm"
              style={{ backgroundColor: '#3C6CA8' }}
            >
              Featured
            </span>
          )}
          {hasDiscount && (
            <span
              className="px-2.5 py-1 text-white text-[10px] font-semibold rounded-full shadow-sm"
              style={{ backgroundColor: '#264874' }}
            >
              {Math.round((1 - currentPrice / originalPrice) * 100)}% OFF
            </span>
          )}
        </div>

        {/* Stock Status Overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-white text-charcoal-700 px-3 py-1 text-xs font-semibold rounded-full border border-charcoal-200 uppercase tracking-wide">
              {!product.available ? 'Unavailable' : 'Out of Stock'}
            </span>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-charcoal-900 text-sm sm:text-base leading-tight line-clamp-2 flex-1">
            {product.name}
          </h3>
          <div className="text-right flex-shrink-0">
            {hasMultipleVariations && (
              <span className="block text-[10px] text-charcoal-400 font-medium leading-tight">From</span>
            )}
            {hasDiscount && (
              <span className="block text-[11px] sm:text-xs text-charcoal-300 line-through leading-tight">
                ₱{originalPrice.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
              </span>
            )}
            <span className="block text-base sm:text-lg font-bold text-charcoal-900 leading-tight">
              ₱{currentPrice.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        <p className="text-xs text-charcoal-500 line-clamp-1 mb-3 sm:mb-4">
          {product.description}
        </p>

        <div className="flex-1" />

        {/* View Button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          className="w-full py-2.5 sm:py-3 rounded-full text-white text-sm font-semibold transition-colors"
          style={{ backgroundColor: '#3C6CA8' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#315A8E'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3C6CA8'; }}
        >
          View
        </button>

        {cartQuantity > 0 && (
          <div className="mt-2 text-center text-[10px] sm:text-xs text-brand-700 font-medium bg-cream-100 rounded-full py-1 border border-brand-100">
            {cartQuantity} in cart
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuItemCard;
