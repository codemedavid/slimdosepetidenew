import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, ProductBundleTier, Protocol, ProductVariation } from '../types';
import Header from './Header';
import Footer from './Footer';
import ProductDetailModal from './ProductDetailModal';
import { useCart } from '../hooks/useCart';
import { useGlobalDiscount } from '../hooks/useGlobalDiscount';

const PRODUCT_COLUMNS =
  'id, name, slug, description, category, base_price, discount_price, discount_start_date, discount_end_date, discount_active, purity_percentage, molecular_weight, cas_number, sequence, storage_conditions, inclusions, stock_quantity, available, featured, image_url, safety_sheet_url, coa_url, created_at, updated_at';

const ProductPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const cart = useCart();
  const { globalDiscount } = useGlobalDiscount();

  const [product, setProduct] = useState<Product | null>(null);
  const [bundleTiers, setBundleTiers] = useState<ProductBundleTier[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const { data: prod, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('slug', slug)
        .maybeSingle();
      if (cancelled) return;
      if (error || !prod) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { data: variations } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', prod.id)
        .order('quantity_mg', { ascending: true });
      const { data: tiers } = await supabase
        .from('product_bundle_tiers')
        .select('*')
        .eq('product_id', prod.id)
        .eq('active', true)
        .order('min_quantity', { ascending: true });
      const { data: protos } = await supabase
        .from('protocols')
        .select('*')
        .eq('product_id', prod.id)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      setProduct({
        ...(prod as Product),
        variations: (variations as ProductVariation[]) ?? [],
      });
      setBundleTiers((tiers as ProductBundleTier[]) ?? []);
      setProtocols((protos as Protocol[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col bg-cream-50">
      <Header
        cartItemsCount={cart.getTotalItems()}
        onCartClick={() => navigate('/?view=cart')}
        onMenuClick={() => navigate('/')}
      />
      <main className="flex-grow">
        <div className="container mx-auto px-3 sm:px-4 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="text-charcoal-700 hover:text-brand-600 font-medium flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
        </div>
        {loading && (
          <div className="flex items-center justify-center py-24 text-charcoal-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading product…
          </div>
        )}
        {notFound && (
          <div className="text-center py-24">
            <h1 className="text-2xl font-bold text-charcoal-900 mb-2">Product not found</h1>
            <p className="text-charcoal-500 mb-6">We couldn't find a product at /{slug}.</p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-full bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors"
            >
              Browse all products
            </button>
          </div>
        )}
        {product && (
          <ProductDetailModal
            asPage
            product={product}
            bundleTiers={bundleTiers}
            protocols={protocols}
            onClose={() => navigate(-1)}
            onAddToCart={(p, v, q, priceOverride) => cart.addToCart(p, v, q, priceOverride)}
            globalDiscount={globalDiscount}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ProductPage;
