import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FlaskConical, Package, CreditCard, Truck, ArrowLeft, MessageCircle, HelpCircle } from 'lucide-react';
import { useFAQs } from '../hooks/useFAQs';

const categoryIcons: { [key: string]: React.ReactElement } = {
    'PRODUCT & USAGE': <FlaskConical className="w-5 h-5" />,
    'ORDERING & PACKAGING': <Package className="w-5 h-5" />,
    'PAYMENT METHODS': <CreditCard className="w-5 h-5" />,
    'SHIPPING & DELIVERY': <Truck className="w-5 h-5" />,
};

const categoryColors: { [key: string]: string } = {
    'PRODUCT & USAGE': 'text-navy-900 border-navy-900 bg-gold-50/50',
    'ORDERING & PACKAGING': 'text-navy-900 border-navy-900 bg-gold-50/50',
    'PAYMENT METHODS': 'text-navy-900 border-navy-900 bg-gold-50/50',
    'SHIPPING & DELIVERY': 'text-navy-900 border-navy-900 bg-gold-50/50',
};

const FAQ: React.FC = () => {
    const { faqs, categories, loading } = useFAQs();
    const [openItems, setOpenItems] = useState<Set<string>>(new Set());
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const toggleItem = (id: string) => {
        setOpenItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const filteredFAQs = activeCategory
        ? faqs.filter(faq => faq.category === activeCategory)
        : faqs;

    const telegramUrl = `https://t.me/slimdose_mnl`;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-navy-900 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b-4 border-navy-900 sticky top-0 z-10 shadow-sm">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <a
                            href="/"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-navy-900" />
                        </a>
                        <div className="flex items-center gap-2">
                            <HelpCircle className="w-6 h-6 text-gold-500" />
                            <h1 className="text-xl md:text-2xl font-bold text-navy-900">Frequently Asked Questions</h1>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Category Filter */}
                <div className="flex flex-wrap gap-2 mb-8">
                    <button
                        onClick={() => setActiveCategory(null)}
                        className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all border shadow-sm ${activeCategory === null
                            ? 'bg-navy-900 text-white border-navy-900 shadow-md transform scale-105'
                            : 'bg-white text-navy-900 border-navy-900 hover:bg-navy-50'
                            }`}
                    >
                        All
                    </button>
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`px-4 py-2.5 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-2 border shadow-sm ${activeCategory === category
                                ? 'bg-navy-900 text-white border-navy-900 shadow-md transform scale-105'
                                : 'bg-white text-gray-600 border-navy-900 hover:bg-navy-50 hover:text-navy-900'
                                }`}
                        >
                            <span className={activeCategory === category ? 'text-gold-400' : 'text-gold-500'}>
                                {categoryIcons[category]}
                            </span>
                            {category}
                        </button>
                    ))}
                </div>

                {/* FAQ Items by Category */}
                {(activeCategory ? [activeCategory] : categories).map(category => (
                    <div key={category} className="mb-10">
                        {/* Section Header */}
                        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg border border-navy-900 bg-white shadow-sm w-full">
                            <span className="text-gold-500">
                                {categoryIcons[category] || <HelpCircle className="w-5 h-5" />}
                            </span>
                            <h2 className="font-bold text-sm md:text-base uppercase tracking-wide text-navy-900">{category}</h2>
                        </div>

                        <div className="space-y-4">
                            {filteredFAQs
                                .filter(faq => faq.category === category)
                                .map(faq => (
                                    <div
                                        key={faq.id}
                                        className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200"
                                    >
                                        <button
                                            onClick={() => toggleItem(faq.id)}
                                            className="w-full px-6 py-5 flex items-start justify-between text-left group gap-4"
                                        >
                                            <span className="font-bold text-navy-900 text-base md:text-lg group-hover:text-blue-800 transition-colors leading-snug">
                                                {faq.question}
                                            </span>
                                            {openItems.has(faq.id) ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-navy-900 flex-shrink-0 transition-colors mt-1" />
                                            )}
                                        </button>
                                        {openItems.has(faq.id) && (
                                            <div className="px-6 pb-6 pt-0">
                                                <div className="h-px w-full bg-gray-100 mb-4"></div>
                                                <p className="text-gray-600 whitespace-pre-line leading-relaxed text-base">
                                                    {faq.answer}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                ))}

                {/* Contact CTA */}
                <div className="mt-12 bg-white rounded-2xl border border-navy-900/30 p-6 md:p-8 text-center shadow-lg">
                    <h3 className="text-lg md:text-xl font-bold text-navy-900 mb-2">
                        Still have questions?
                    </h3>
                    <p className="text-gray-600 mb-6">
                        We're here to help! Reach out to us via Telegram for quick assistance.
                    </p>
                    <a
                        href={telegramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-navy-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-navy-800 transition-colors shadow-md hover:shadow-lg"
                    >
                        <MessageCircle className="w-5 h-5 text-gold-400" />
                        Chat on Telegram
                    </a>
                </div>
            </div>
        </div>
    );
};

export default FAQ;
