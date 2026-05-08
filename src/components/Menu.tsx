import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MenuItemCard from './MenuItemCard';
import Hero from './Hero';
import type { Product, ProductVariation, CartItem } from '../types';
import { Search, ChevronDown, Package } from 'lucide-react';
import { useGlobalDiscount } from '../hooks/useGlobalDiscount';

interface MenuProps {
  menuItems: Product[];
  loading?: boolean;
  addToCart: (product: Product, variation?: ProductVariation, quantity?: number, priceOverride?: number) => void;
  cartItems: CartItem[];
  updateQuantity: (index: number, quantity: number) => void;
}

const Menu: React.FC<MenuProps> = ({ menuItems, loading = false, addToCart, cartItems }) => {
  const { globalDiscount } = useGlobalDiscount();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'purity'>('name');
  const productsRef = useRef<HTMLDivElement | null>(null);

  const filteredProducts = menuItems.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'price':
        return a.base_price - b.base_price;
      case 'purity':
        return b.purity_percentage - a.purity_percentage;
      default:
        return 0;
    }
  });

  const sortLabels: Record<typeof sortBy, string> = {
    name: 'Most Popular',
    price: 'Lowest Price',
    purity: 'Highest Purity',
  };

  const getCartQuantity = (productId: string, variationId?: string) => {
    return cartItems
      .filter(item =>
        item.product.id === productId &&
        (variationId ? item.variation?.id === variationId : !item.variation)
      )
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleProductClick = (product: Product) => {
    if (product.slug) {
      navigate(`/${product.slug}`);
    }
  };

  return (
    <>
      <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFCF6 100%)' }}>
        <Hero
          onShopAll={() => {
            productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />

        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl" ref={productsRef}>
          {/* Section Header */}
          <div className="mb-5">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: '#3C6CA8' }}>
              All Products
            </h1>
            <p className="mt-2 text-sm sm:text-base text-charcoal-500">
              Premium research peptides with 99%+ purity
            </p>
          </div>

          {/* Pill Search */}
          <div className="mb-3 relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-14 pr-5 rounded-full border border-charcoal-100 bg-white text-base text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
            />
          </div>

          {/* Pill Sort */}
          <div className="mb-6 inline-flex">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'price' | 'purity')}
                aria-label="Sort products"
                className="appearance-none h-12 pl-5 pr-12 rounded-full border border-charcoal-100 bg-white text-sm font-semibold text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 cursor-pointer"
              >
                <option value="name">{sortLabels.name}</option>
                <option value="price">{sortLabels.price}</option>
                <option value="purity">{sortLabels.purity}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-500" />
            </div>
          </div>

          {/* Products Grid */}
          {loading && menuItems.length === 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-charcoal-100 overflow-hidden shadow-soft animate-pulse"
                >
                  <div className="aspect-square bg-charcoal-100" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-charcoal-100 rounded w-3/4" />
                    <div className="h-3 bg-charcoal-100 rounded w-1/2" />
                    <div className="h-8 bg-charcoal-100 rounded-full w-full mt-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-20">
              <div className="bg-white rounded-2xl shadow-soft p-12 max-w-md mx-auto border border-charcoal-100">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-cream-100">
                  <Package className="w-10 h-10 text-brand-500" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold text-charcoal-900 mb-2">No products found</h3>
                <p className="text-charcoal-500 mb-6">
                  {searchQuery
                    ? `No products match "${searchQuery}".`
                    : 'No products available.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-brand-600 font-semibold hover:text-brand-700 hover:underline"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
              {sortedProducts.map((product) => (
                <MenuItemCard
                  key={product.id}
                  product={product}
                  cartQuantity={getCartQuantity(product.id)}
                  onProductClick={handleProductClick}
                  onAddToCart={addToCart}
                  globalDiscount={globalDiscount}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Menu;
