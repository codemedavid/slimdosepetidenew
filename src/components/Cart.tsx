import React, { useEffect, useMemo } from 'react';
import { Trash2, ShoppingBag, ArrowLeft, CreditCard, Plus, Minus, Sparkles, Heart, Tag, Info, X } from 'lucide-react';
import type { CartItem } from '../types';
import { useBundleTiers } from '../hooks/useBundleTiers';
import { useGlobalDiscount } from '../hooks/useGlobalDiscount';
import { computeCartPricing } from '../utils/pricing';

interface CartProps {
  cartItems: CartItem[];
  updateQuantity: (index: number, quantity: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  refreshCartPrices: () => Promise<boolean>;
  pricesUpdatedAt: number | null;
  dismissPriceUpdateNotice: () => void;
  onContinueShopping: () => void;
  onCheckout: () => void;
}

const Cart: React.FC<CartProps> = ({
  cartItems,
  updateQuantity,
  removeFromCart,
  clearCart,
  refreshCartPrices,
  pricesUpdatedAt,
  dismissPriceUpdateNotice,
  onContinueShopping,
  onCheckout,
}) => {
  const productIds = useMemo(
    () => cartItems.map((i) => i.product.id),
    [cartItems]
  );
  const { tiersByProduct } = useBundleTiers(productIds);
  const { globalDiscount } = useGlobalDiscount();

  // Refresh prices when cart drawer opens
  useEffect(() => {
    refreshCartPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pricing = useMemo(
    () => computeCartPricing(cartItems, tiersByProduct, globalDiscount),
    [cartItems, tiersByProduct, globalDiscount]
  );

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-md">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-12 border-2 border-blue-100">
            <div className="bg-gradient-to-br from-black to-gray-900 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl border border-navy-900/30">
              <ShoppingBag className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-2">
              Your cart is empty
              <Heart className="w-6 h-6 text-pink-400" />
            </h2>
            <p className="text-gray-600 mb-8">
              Start adding amazing products to your cart! ✨
            </p>
            <button
              onClick={onContinueShopping}
              className="bg-navy-900 hover:bg-navy-800 text-white px-8 py-4 rounded-lg font-semibold shadow-lg hover:shadow-gold-glow transform hover:scale-105 transition-all w-full flex items-center justify-center gap-2 border border-navy-900/20"
            >
              <ArrowLeft className="w-5 h-5" />
              Browse Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  const finalTotal = pricing.subtotal;

  // Per-item stock availability (kept live via the cart's realtime refresh).
  const itemAvailability = cartItems.map((item) => {
    const stock = item.variation ? item.variation.stock_quantity : item.product.stock_quantity;
    return {
      stock,
      outOfStock: stock <= 0,
      insufficient: stock > 0 && item.quantity > stock,
    };
  });
  const hasUnavailableItems = itemAvailability.some((a) => a.outOfStock || a.insufficient);

  return (
    <div className="min-h-screen bg-white py-6 md:py-8">
      <div className="container mx-auto px-3 md:px-4">
        {/* Price update notice */}
        {pricesUpdatedAt && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 md:p-4 text-amber-800">
            <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm md:text-base font-medium">
              Prices have been updated to the latest from our store.
            </div>
            <button
              onClick={dismissPriceUpdateNotice}
              className="p-1 hover:bg-amber-100 rounded"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 md:mb-8">
          <button
            onClick={onContinueShopping}
            className="text-black hover:text-gold-600 font-medium mb-4 flex items-center gap-2 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm md:text-base">Continue Shopping</span>
          </button>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              Shopping Cart
              <Sparkles className="w-6 h-6 text-gold-600" />
            </h1>
            <button
              onClick={clearCart}
              className="text-red-500 hover:text-red-600 font-medium flex items-center gap-1.5 md:gap-2 transition-colors text-sm md:text-base hover:scale-105 transform"
            >
              <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            {cartItems.map((item, index) => {
              const line = pricing.lines[index];
              const availability = itemAvailability[index];
              const itemUnavailable = availability.outOfStock || availability.insufficient;
              return (
              <div
                key={index}
                className={`bg-white backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl p-4 md:p-6 transition-all animate-fadeIn border ${
                  itemUnavailable ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200 hover:border-navy-700'
                }`}
              >
                <div className="flex gap-4 md:gap-6">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden shadow-md border border-gray-300">
                    {item.product.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-black to-gray-700 bg-clip-text text-transparent">
                        {item.product.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1 truncate">
                          {item.product.name}
                        </h3>
                        {item.variation && (
                          <p className="text-xs md:text-sm text-gray-700 font-medium">
                            Variation: {item.variation.name}
                          </p>
                        )}
                        {item.product.purity_percentage && item.product.purity_percentage > 0 ? (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-green-100 text-green-700">
                              {item.product.purity_percentage}% Pure
                            </span>
                          </div>
                        ) : null}
                        {line?.appliedTier && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold bg-green-100 text-green-700">
                            <Tag className="w-3 h-3" />
                            Bundle: {Number(line.appliedTier.discount_percentage)}% OFF
                          </div>
                        )}
                        {availability.outOfStock ? (
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold bg-red-100 text-red-700">
                            <X className="w-3 h-3" />
                            Out of stock — please remove
                          </div>
                        ) : availability.insufficient ? (
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold bg-amber-100 text-amber-700">
                            <Info className="w-3 h-3" />
                            Only {availability.stock} left — reduce quantity
                          </div>
                        ) : null}
                      </div>
                      <button
                        onClick={() => removeFromCart(index)}
                        className="p-1.5 md:p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors ml-2"
                        title="Remove from cart"
                      >
                        <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center mt-3 md:mt-4">
                      <div className="flex items-center border-2 border-gray-200 rounded-xl bg-white shadow-sm">
                        <button
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                          className="p-1.5 md:p-2 hover:bg-gray-50 transition-colors rounded-l-lg"
                        >
                          <Minus className="w-3 h-3 md:w-4 md:h-4 text-black" />
                        </button>
                        <span className="px-3 md:px-4 py-1.5 md:py-2 font-bold text-gray-800 min-w-[32px] md:min-w-[40px] text-center text-sm md:text-base">
                          {item.quantity}
                          {(() => {
                            const availableStock = item.variation ? item.variation.stock_quantity : item.product.stock_quantity;
                            if (availableStock > 0) {
                              return <span className="block text-[10px] text-gray-500">/ {availableStock}</span>;
                            }
                            return null;
                          })()}
                        </span>
                        <button
                          onClick={() => {
                            const availableStock = item.variation ? item.variation.stock_quantity : item.product.stock_quantity;
                            if (item.quantity >= availableStock) {
                              alert(`Only ${availableStock} item(s) available in stock.`);
                              return;
                            }
                            updateQuantity(index, item.quantity + 1);
                          }}
                          disabled={(() => {
                            const availableStock = item.variation ? item.variation.stock_quantity : item.product.stock_quantity;
                            return item.quantity >= availableStock;
                          })()}
                          className="p-1.5 md:p-2 hover:bg-gray-50 transition-colors rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3 md:w-4 md:h-4 text-black" />
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="text-xl md:text-2xl font-bold text-black">
                          ₱{(line ? line.lineSubtotal : item.price * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                        </div>
                        {line?.bundlePercent ? (
                          <>
                            <div className="text-[10px] md:text-xs text-gray-400 line-through">
                              ₱{(line.unitBasePrice * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] md:text-xs text-green-600 font-medium">
                              Save ₱{line.lineSavings.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                            </div>
                          </>
                        ) : (
                          <div className="text-[10px] md:text-xs text-gray-500">
                            ₱{(line ? line.unitFinalPrice : item.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })} each
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white backdrop-blur-sm rounded-lg shadow-xl p-5 md:p-6 sticky top-24 border border-gray-200">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
                Order Summary
                <Sparkles className="w-5 h-5 text-gold-600" />
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-700 text-sm md:text-base">
                  <span>Subtotal ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                  <span className="font-semibold">₱{pricing.subtotalBeforeBundle.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</span>
                </div>

                {pricing.hasBundleDiscount && (
                  <div className="flex justify-between items-center bg-green-50 -mx-5 px-5 py-2 border-y border-green-100">
                    <span className="flex items-center gap-1.5 text-green-700 font-medium text-sm">
                      <Tag className="w-4 h-4" />
                      Bundle discount
                    </span>
                    <span className="font-bold text-green-700 text-sm">
                      -₱{pricing.bundleSavings.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1 text-gray-700 text-xs md:text-sm">
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className="text-gray-700 font-medium">Calculated at checkout</span>
                  </div>
                  <div className="mt-2 space-y-1 text-gray-600">
                    <p className="font-semibold text-theme-text">J&T Shipping Rates:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Luzon: ₱150</li>
                      <li>Visayas: ₱120</li>
                      <li>Mindanao: ₱90</li>
                    </ul>
                    <p className="font-semibold text-theme-text mt-2">Maxim Delivery:</p>
                    <p className="pl-4">₱0 (Booking fee paid by customer upon delivery)</p>
                  </div>
                </div>

                <div className="border-t-2 border-dashed border-gray-200 pt-3 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-base md:text-lg font-bold text-gray-900">Total</span>
                    <span className="text-2xl md:text-3xl font-bold text-black">
                      ₱{finalTotal.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                  {(pricing.hasBundleDiscount || pricing.hasItemDiscount) && (
                    <p className="text-xs text-green-700 mt-1 text-right font-medium">
                      A discount is already applied — promo codes can't be combined.
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1 text-right">+ Shipping fee (calculated on checkout)</p>
                </div>
              </div>

              {hasUnavailableItems && (
                <p className="mb-3 text-xs md:text-sm text-red-600 font-medium text-center bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Some items are out of stock or exceed available stock. Please update your cart to continue.
                </p>
              )}
              <button
                onClick={onCheckout}
                disabled={hasUnavailableItems}
                className="w-full bg-navy-900 hover:bg-navy-800 text-white py-3 md:py-4 rounded-lg font-semibold text-sm md:text-base shadow-lg hover:shadow-gold-glow transform hover:scale-105 transition-all mb-3 flex items-center justify-center gap-2 border border-navy-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
              >
                <CreditCard className="w-5 h-5" />
                Proceed to Checkout
              </button>

              <button
                onClick={onContinueShopping}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 hover:border-navy-900 py-2.5 md:py-3 rounded-lg font-medium text-sm md:text-base transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Continue Shopping
              </button>

              <div className="mt-6 pt-6 border-t-2 border-dashed border-gray-200 space-y-2">
                <p className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                  <span className="text-green-500 text-lg">✓</span>
                  Secure checkout
                </p>
                <p className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                  <span className="text-green-500 text-lg">✓</span>
                  Lab-tested products
                </p>
                <p className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                  <span className="text-green-500 text-lg">✓</span>
                  Fast delivery 🚚
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
