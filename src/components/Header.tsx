import React, { useState } from 'react';
import { useCOAPageSetting } from '../hooks/useCOAPageSetting';
import { ShoppingCart, Menu, X, MessageCircle, Calculator, FileText, HelpCircle, Truck, BookOpen } from 'lucide-react';

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ cartItemsCount, onCartClick, onMenuClick }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { coaPageEnabled } = useCOAPageSetting();

  return (
    <>
      <header className="bg-white sticky top-0 z-50 border-b-4 shadow-sm" style={{ borderBottomColor: '#3C6CA8' }}>
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo and Brand */}
            <button
              onClick={() => { onMenuClick(); setMobileMenuOpen(false); }}
              className="flex items-center space-x-3 hover:opacity-80 transition-all group min-w-0 flex-1 max-w-[calc(100%-130px)] sm:max-w-none sm:flex-initial"
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-gray-200">
                  <img
                    src="/assets/logo.jpeg"
                    alt="SlimDose Peptides"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="text-left min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis tracking-tight" style={{ color: '#3C6CA8' }}>
                  SlimDose Peptides
                </h1>
                <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    Premium Peptide Solutions
                  </span>
                </p>
              </div>
            </button>

            {/* Right Side Navigation */}
            <div className="flex items-center gap-2 md:gap-4 ml-auto">
              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-2 lg:gap-4">
                <button
                  onClick={onMenuClick}
                  className="text-sm font-medium text-gray-600 hover:text-theme-accent transition-colors"
                >
                  Products
                </button>
                <a
                  href="/track-order"
                  className="text-sm font-medium text-gray-600 hover:text-theme-accent transition-colors flex items-center gap-1"
                >
                  <Truck className="w-4 h-4" />
                  Track Order
                </a>
                <a
                  href="/calculator"
                  className="text-sm font-medium text-gray-600 hover:text-theme-accent transition-colors flex items-center gap-1"
                >
                  <Calculator className="w-4 h-4" />
                  Calculator
                </a>
                {coaPageEnabled && (
                  <a
                    href="/coa"
                    className="text-sm font-medium text-gray-600 hover:text-theme-accent transition-colors flex items-center gap-1"
                  >
                    <FileText className="w-4 h-4" />
                    Lab Tests
                  </a>
                )}
                <a
                  href="/faq"
                  className="text-sm font-medium text-gray-600 hover:text-theme-accent transition-colors flex items-center gap-1"
                >
                  <HelpCircle className="w-4 h-4" />
                  FAQ
                </a>
                <a
                  href="/peptalk"
                  className="text-sm font-medium text-gray-600 hover:text-theme-accent transition-colors flex items-center gap-1"
                >
                  <BookOpen className="w-4 h-4" />
                  Peptalk
                </a>
                <a
                  href="https://t.me/+fGtShIUkbB84YzZl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-600 hover:text-[#0088cc] transition-colors flex items-center gap-1"
                >
                  <MessageCircle className="w-4 h-4" />
                  Join Community
                </a>
              </nav>

              {/* Cart Button */}
              <button
                onClick={onCartClick}
                className="relative p-2 text-theme-text hover:text-theme-accent transition-colors"
              >
                <ShoppingCart className="w-6 h-6" />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[11px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ring-2 ring-white shadow">
                    {cartItemsCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-theme-text hover:text-theme-accent transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Sidebar Drawer */}
          <div
            className="absolute top-0 right-0 bottom-0 w-[300px] sm:w-[320px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            style={{ borderLeft: '4px solid #3C6CA8' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              className="relative flex items-center justify-between px-5 pt-6 pb-5"
              style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #FFFCF6 100%)', borderBottom: '1px solid #EFEFEF' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-offset-2"
                  style={{ ['--tw-ring-color' as string]: '#C2D4EA' }}
                >
                  <img src="/assets/logo.jpeg" alt="SlimDose" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base leading-tight truncate" style={{ color: '#3C6CA8' }}>
                    SlimDose
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-charcoal-400 mt-0.5">
                    Premium Peptides
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="p-2 -mr-2 text-charcoal-500 transition-colors rounded-full hover:bg-white"
                style={{ flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#3C6CA8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = ''; }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto px-4 py-5 bg-white">
              {/* Section: Shop */}
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-400">Shop</p>
              <div className="flex flex-col gap-1 mb-5">
                <button
                  onClick={() => { onMenuClick(); setMobileMenuOpen(false); }}
                  className="sidebar-link group"
                >
                  <span className="sidebar-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                  </span>
                  <span className="flex-1">Products</span>
                </button>
                <a href="/track-order" className="sidebar-link group">
                  <span className="sidebar-icon"><Truck className="w-[18px] h-[18px]" /></span>
                  <span className="flex-1">Track Order</span>
                </a>
              </div>

              {/* Section: Tools */}
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-400">Tools</p>
              <div className="flex flex-col gap-1 mb-5">
                <a href="/calculator" className="sidebar-link group">
                  <span className="sidebar-icon"><Calculator className="w-[18px] h-[18px]" /></span>
                  <span className="flex-1">Peptide Calculator</span>
                </a>
                {coaPageEnabled && (
                  <a href="/coa" className="sidebar-link group">
                    <span className="sidebar-icon"><FileText className="w-[18px] h-[18px]" /></span>
                    <span className="flex-1">Lab Tests (COA)</span>
                  </a>
                )}
              </div>

              {/* Section: Resources */}
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-400">Resources</p>
              <div className="flex flex-col gap-1 mb-5">
                <a href="/faq" className="sidebar-link group">
                  <span className="sidebar-icon"><HelpCircle className="w-[18px] h-[18px]" /></span>
                  <span className="flex-1">FAQ</span>
                </a>
                <a href="/peptalk" className="sidebar-link group">
                  <span className="sidebar-icon"><BookOpen className="w-[18px] h-[18px]" /></span>
                  <span className="flex-1">Peptalk</span>
                </a>
              </div>
            </nav>

            {/* Footer CTA */}
            <div className="p-4 border-t border-charcoal-100 bg-white">
              <a
                href="https://t.me/+fGtShIUkbB84YzZl"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-full text-white text-sm font-semibold transition-all"
                style={{ backgroundColor: '#3C6CA8', boxShadow: '0 4px 14px rgba(60, 108, 168, 0.25)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#315A8E'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3C6CA8'; }}
              >
                <MessageCircle className="w-4 h-4" />
                Join Community
              </a>
              <p className="mt-3 text-center text-[10px] text-charcoal-400">
                © {new Date().getFullYear()} SlimDose Peptides
              </p>
            </div>

            <style>{`
              .sidebar-link {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 11px 12px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 600;
                color: #2A2A2A;
                text-align: left;
                border: 1px solid transparent;
                transition: all 0.18s ease;
              }
              .sidebar-link:hover {
                background-color: #F2F6FB;
                color: #3C6CA8;
                border-color: #C2D4EA;
                transform: translateX(2px);
              }
              .sidebar-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 10px;
                background-color: #FFFCF6;
                color: #3C6CA8;
                border: 1px solid #EFEFEF;
                transition: all 0.18s ease;
                flex-shrink: 0;
              }
              .sidebar-link:hover .sidebar-icon {
                background-color: #FFFFFF;
                border-color: #3C6CA8;
                box-shadow: 0 2px 8px rgba(60, 108, 168, 0.12);
              }
            `}</style>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
