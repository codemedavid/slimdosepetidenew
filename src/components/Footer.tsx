import React from 'react';
import { MessageCircle, Shield, Heart, HelpCircle, Calculator, FileText, Truck } from 'lucide-react';
import { useCOAPageSetting } from '../hooks/useCOAPageSetting';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { coaPageEnabled } = useCOAPageSetting();

  // Contact Links
  //   const whatsappMessage = encodeURIComponent('Hi! I would like to inquire about your products.');
  //   const whatsappUrl = `https://wa.me/639062349763?text=${whatsappMessage}`;

  return (
    <footer className="bg-white border-t border-gray-100 pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">

          {/* Brand Section */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100">
              <img
                src="/assets/logo.jpeg"
                alt="SlimDose Peptides"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg tracking-tight" style={{ color: '#3C6CA8' }}>
                SlimDose Peptides
              </div>
              <div className="text-xs text-gray-500">Premium Peptide Solutions</div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center gap-4 justify-center md:justify-end">
            {/* Lab Reports & FAQ Removed */}
            {/* WhatsApp Removed */}
            <a
              href="/track-order"
              className="text-gray-500 hover:text-theme-accent transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Truck className="w-4 h-4" />
              Track Order
            </a>
            <a
              href="/calculator"
              className="text-gray-500 hover:text-theme-accent transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Calculator className="w-4 h-4" />
              Calculator
            </a>
            {coaPageEnabled && (
              <a
                href="/coa"
                className="text-gray-500 hover:text-theme-accent transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                Lab Tests
              </a>
            )}
            <a
              href="/faq"
              className="text-gray-500 hover:text-theme-accent transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <HelpCircle className="w-4 h-4" />
              FAQ
            </a>
            <a
              href="https://t.me/+fGtShIUkbB84YzZl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-[#0088cc] transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              Join Community
            </a>
          </div>

        </div>

        {/* Footer Bottom */}
        <div className="border-t border-gray-100 pt-6 text-center">
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
            Made with
            <Heart className="w-3 h-3 text-theme-secondary fill-theme-secondary" />
            © {currentYear} SlimDose Peptides.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
