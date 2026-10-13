import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useCart } from './hooks/useCart';
import Header from './components/Header';
import SubNav from './components/SubNav';
import Menu from './components/Menu';
import Cart from './components/Cart';
import Checkout from './components/Checkout';
import FloatingCartButton from './components/FloatingCartButton';
import Footer from './components/Footer';
import PromoSignup from './components/PromoSignup';
import { useMenu } from './hooks/useMenu';
import { supabase } from './lib/supabase';

// Secondary pages are split into their own chunks so shoppers on the menu
// don't download the admin panel and other routes they never open.
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const COA = React.lazy(() => import('./components/COA'));
const FAQ = React.lazy(() => import('./components/FAQ'));
const PeptideCalculator = React.lazy(() => import('./components/PeptideCalculator'));
const OrderTracking = React.lazy(() => import('./components/OrderTracking'));
const SmartGuide = React.lazy(() => import('./components/SmartGuide'));
const ArticleDetail = React.lazy(() => import('./components/ArticleDetail'));
const ProductPage = React.lazy(() => import('./components/ProductPage'));


// import { useCOAPageSetting } from './hooks/useCOAPageSetting';

function MainApp() {
  const cart = useCart();
  const { menuItems, loading: menuLoading, refreshProducts } = useMenu();
  const [currentView, setCurrentView] = React.useState<'menu' | 'cart' | 'checkout'>('menu');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  // PayMongo disabled for now — redirect-notice handling commented out, not removed.
  // const [paymongoNotice, setPaymongoNotice] = React.useState<
  //   { kind: 'success' | 'cancel'; orderId: string | null } | null
  // >(null);

  // React.useEffect(() => {
  //   const params = new URLSearchParams(window.location.search);
  //   const result = params.get('paymongo');
  //   if (result === 'success' || result === 'cancel') {
  //     const orderId = params.get('order_id');
  //     if (result === 'success') {
  //       cart.clearCart();
  //       setPaymongoNotice({ kind: 'success', orderId });
  //       setCurrentView('menu');
  //       // Auto-tag the order as paid in admin. The webhook is the source of
  //       // truth, but this fires immediately after redirect so the order shows
  //       // as paid even before PayMongo's webhook lands. Idempotent server-side.
  //       if (orderId) {
  //         supabase.functions
  //           .invoke('paymongo-verify-payment', { body: { order_id: orderId } })
  //           .catch((err) => console.warn('paymongo-verify-payment failed:', err));
  //       }
  //     } else {
  //       setPaymongoNotice({ kind: 'cancel', orderId });
  //       setCurrentView('checkout');
  //     }
  //     params.delete('paymongo');
  //     params.delete('order_id');
  //     const next = window.location.pathname + (params.toString() ? `?${params}` : '');
  //     window.history.replaceState({}, '', next);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  const handleViewChange = (view: 'menu' | 'cart' | 'checkout') => {
    setCurrentView(view);
    // Scroll to top when changing views
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  // Filter products based on selected category
  const filteredProducts = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-white font-inter flex flex-col">
      <Header
        cartItemsCount={cart.getTotalItems()}
        onCartClick={() => handleViewChange('cart')}
        onMenuClick={() => handleViewChange('menu')}
      />

      <PromoSignup />

      {currentView === 'menu' && (
        <SubNav selectedCategory={selectedCategory} onCategoryClick={handleCategoryClick} />
      )}

      {/* PayMongo disabled for now — redirect notice banner commented out, not removed.
      {paymongoNotice && (
        <div className={`px-4 py-3 text-sm md:text-base font-medium flex items-center justify-between gap-3 ${
          paymongoNotice.kind === 'success'
            ? 'bg-green-50 text-green-800 border-b border-green-200'
            : 'bg-amber-50 text-amber-800 border-b border-amber-200'
        }`}>
          <span>
            {paymongoNotice.kind === 'success'
              ? `✅ Payment received! Your order${paymongoNotice.orderId ? ` (${paymongoNotice.orderId.slice(0, 8)})` : ''} is confirmed. We'll start processing it shortly.`
              : `⚠️ Payment was cancelled${paymongoNotice.orderId ? ` for order ${paymongoNotice.orderId.slice(0, 8)}` : ''}. You can try again or pick a different payment method.`}
          </span>
          <button
            onClick={() => setPaymongoNotice(null)}
            className="px-2 py-1 rounded hover:bg-black/5"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      */}

      <main className="flex-grow">
        {currentView === 'menu' && (
          <Menu
            menuItems={filteredProducts}
            loading={menuLoading}
            addToCart={cart.addToCart}
            cartItems={cart.cartItems}
            updateQuantity={cart.updateQuantity}
          />
        )}

        {currentView === 'cart' && (
          <Cart
            cartItems={cart.cartItems}
            updateQuantity={cart.updateQuantity}
            removeFromCart={cart.removeFromCart}
            clearCart={cart.clearCart}
            getTotalPrice={cart.getTotalPrice}
            refreshCartPrices={cart.refreshCartPrices}
            pricesUpdatedAt={cart.pricesUpdatedAt}
            dismissPriceUpdateNotice={cart.dismissPriceUpdateNotice}
            onContinueShopping={() => handleViewChange('menu')}
            onCheckout={() => handleViewChange('checkout')}
          />
        )}

        {currentView === 'checkout' && (
          <Checkout
            cartItems={cart.cartItems}
            totalPrice={cart.getTotalPrice()}
            refreshCartPrices={cart.refreshCartPrices}
            pricesUpdatedAt={cart.pricesUpdatedAt}
            dismissPriceUpdateNotice={cart.dismissPriceUpdateNotice}
            onBack={() => handleViewChange('cart')}
          />
        )}
      </main>

      {currentView === 'menu' && (
        <>
          <FloatingCartButton
            itemCount={cart.getTotalItems()}
            onCartClick={() => handleViewChange('cart')}
          />
          <Footer />
        </>
      )}
    </div>
  );
}


function App() {
  //   const { coaPageEnabled } = useCOAPageSetting();

  return (
    <Router>
      <React.Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/coa" element={<COA />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/calculator" element={<PeptideCalculator />} />
        <Route path="/track-order" element={<OrderTracking />} />
        <Route path="/peptalk" element={<SmartGuide />} />
        <Route path="/peptalk/:id" element={<ArticleDetail />} />
        <Route path="/admin" element={<AdminDashboard />} />
        {/* Catch-all product slug — must stay LAST so it doesn't shadow named routes */}
        <Route path="/:slug" element={<ProductPage />} />
      </Routes>
      </React.Suspense>
    </Router>
  );
}

export default App;
