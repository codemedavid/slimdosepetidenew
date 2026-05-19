import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Calendar, User, ShoppingCart, Package, Check } from 'lucide-react';
import { useGlobalDiscount } from '../hooks/useGlobalDiscount';
import { getGlobalDiscountedPrice } from '../utils/pricing';

interface Article {
    id: string;
    title: string;
    content: string;
    cover_image: string | null;
    author: string;
    published_date: string;
    related_product_ids: string[] | null;
}

interface RelatedProduct {
    id: string;
    name: string;
    base_price: number;
    discount_price: number | null;
    discount_active: boolean;
    image_url: string | null;
    variations: { id: string; name: string; price: number }[] | null;
}

// Simple HTML sanitizer - only allows safe formatting tags
const sanitizeHtml = (html: string): string => {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove script tags and event handlers
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(s => s.remove());

    // Remove event handlers from all elements
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
        // Remove any attribute that starts with 'on' (event handlers)
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return temp.innerHTML;
};

export default function ArticleDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { globalDiscount } = useGlobalDiscount();
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
    const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set());
    const [cartItemCount, setCartItemCount] = useState(0);
    const [showCartToast, setShowCartToast] = useState(false);

    useEffect(() => {
        if (id) {
            fetchArticle(id);
        }
    }, [id]);

    const fetchArticle = async (articleId: string) => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('guide_topics')
                .select('*')
                .eq('id', articleId)
                .eq('is_enabled', true)
                .single();

            if (error) throw error;

            if (data) {
                setArticle(data);
                // Fetch related products if any
                if (data.related_product_ids && data.related_product_ids.length > 0) {
                    fetchRelatedProducts(data.related_product_ids);
                }
            }
        } catch (error) {
            console.error('Error fetching article:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRelatedProducts = async (productIds: string[]) => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, base_price, discount_price, discount_active, image_url, variations:product_variations(id, name, price)')
                .in('id', productIds);

            if (error) throw error;
            setRelatedProducts(data || []);
        } catch (error) {
            console.error('Error fetching related products:', error);
        }
    };

    const handleAddToCart = (product: RelatedProduct) => {
        // Create cart item with all required fields matching the Product type
        const newCartItem = {
            product: {
                id: product.id,
                name: product.name,
                description: '',
                category: '',
                base_price: product.base_price,
                discount_price: product.discount_price,
                discount_start_date: null,
                discount_end_date: null,
                discount_active: product.discount_active,
                purity_percentage: 0,
                molecular_weight: null,
                cas_number: null,
                sequence: null,
                storage_conditions: '',
                inclusions: null,
                stock_quantity: 999,
                available: true,
                featured: false,
                image_url: product.image_url,
                safety_sheet_url: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            variation: product.variations && product.variations.length > 0
                ? {
                    id: product.variations[0].id,
                    product_id: product.id,
                    name: product.variations[0].name,
                    quantity_mg: 0,
                    price: product.variations[0].price,
                    discount_price: null,
                    discount_active: false,
                    stock_quantity: 999,
                    created_at: new Date().toISOString(),
                }
                : undefined,
            quantity: 1,
            price: product.discount_active && product.discount_price
                ? product.discount_price
                : (product.variations && product.variations.length > 0 ? product.variations[0].price : product.base_price)
        };

        // Directly update localStorage (since ArticleDetail is on a separate route)
        try {
            const savedCart = localStorage.getItem('peptide_cart');
            let cartItems = savedCart ? JSON.parse(savedCart) : [];

            // Check if item already exists
            const existingIndex = cartItems.findIndex(
                (item: any) => item.product.id === newCartItem.product.id &&
                    (newCartItem.variation ? item.variation?.id === newCartItem.variation.id : !item.variation)
            );

            if (existingIndex > -1) {
                cartItems[existingIndex].quantity += 1;
            } else {
                cartItems.push(newCartItem);
            }

            localStorage.setItem('peptide_cart', JSON.stringify(cartItems));
        } catch (error) {
            console.error('Error adding to cart:', error);
        }

        setAddedToCart(prev => new Set([...prev, product.id]));
        setCartItemCount(prev => prev + 1);
        setShowCartToast(true);

        // Hide toast after 3 seconds
        setTimeout(() => setShowCartToast(false), 3000);

        // Reset button after 2 seconds
        setTimeout(() => {
            setAddedToCart(prev => {
                const next = new Set(prev);
                next.delete(product.id);
                return next;
            });
        }, 2000);
    };

    const getProductPricing = (product: RelatedProduct) => {
        const baseFromPrice = product.variations && product.variations.length > 0
            ? Math.min(...product.variations.map(v => v.price))
            : product.base_price;

        const individualPrice = product.discount_active && product.discount_price
            ? product.discount_price
            : baseFromPrice;

        const globalResult = getGlobalDiscountedPrice(baseFromPrice, product.id, globalDiscount);
        const finalPrice = globalResult.hasGlobalDiscount && globalResult.price < individualPrice
            ? globalResult.price
            : individualPrice;

        return {
            originalPrice: baseFromPrice,
            price: finalPrice,
            hasDiscount: finalPrice < baseFromPrice,
        };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-navy-900 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-navy-900 mb-4">Article Not Found</h2>
                    <button
                        onClick={() => navigate('/peptalk')}
                        className="text-theme-accent hover:underline"
                    >
                        Back to Articles
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Floating Cart Toast */}
            {showCartToast && (
                <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right duration-300">
                    <div className="bg-green-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
                        <div className="bg-white/20 rounded-full p-1">
                            <Check className="w-4 h-4" />
                        </div>
                        <span className="font-medium">Added to cart!</span>
                    </div>
                </div>
            )}

            {/* Floating Cart Button */}
            {cartItemCount > 0 && (
                <button
                    onClick={() => navigate('/')}
                    className="fixed bottom-6 right-6 z-50 bg-navy-900 text-white p-4 rounded-full shadow-xl hover:bg-navy-800 transition-all hover:scale-105"
                >
                    <ShoppingCart className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 bg-theme-accent text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                        {cartItemCount}
                    </span>
                </button>
            )}

            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="container mx-auto px-4 py-4">
                    <button
                        onClick={() => navigate('/peptalk')}
                        className="flex items-center gap-2 text-gray-600 hover:text-navy-900 transition-colors group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Back to Peptalk</span>
                    </button>
                </div>
            </div>

            {/* Hero Section with Cover Image */}
            {article.cover_image && (
                <div className="relative w-full h-64 md:h-96 bg-gray-200">
                    <img
                        src={article.cover_image}
                        alt={article.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
            )}

            {/* Article Content */}
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <article className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    {/* Article Header */}
                    <div className="p-8 md:p-12 border-b border-gray-200">
                        <h1 className="text-3xl md:text-4xl font-bold text-navy-900 mb-6 leading-tight">
                            {article.title}
                        </h1>

                        {/* Meta Information */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gold-500" />
                                <span>By {article.author}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gold-500" />
                                <span>{new Date(article.published_date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Article Body */}
                    <div className="p-8 md:p-12">
                        <div
                            className="prose prose-lg max-w-none text-gray-700 leading-relaxed text-base md:text-lg"
                            style={{ whiteSpace: 'pre-wrap' }}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
                        />
                    </div>

                    {/* Related Products Section */}
                    {relatedProducts.length > 0 && (
                        <div className="border-t border-gray-200 p-8 md:p-12 bg-gradient-to-br from-gray-50 to-white">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-gradient-to-br from-theme-accent to-navy-900 rounded-xl">
                                    <Package className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-navy-900">Featured Products</h3>
                                    <p className="text-sm text-gray-500">Products mentioned in this article</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {relatedProducts.map((product) => {
                                    const productPricing = getProductPricing(product);
                                    return (
                                    <div
                                        key={product.id}
                                        className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                                    >
                                        <div className="flex items-center gap-4 p-4">
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.name}
                                                    className="w-20 h-20 rounded-lg object-cover shrink-0"
                                                />
                                            ) : (
                                                <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                    <Package className="w-8 h-8 text-gray-300" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-navy-900 truncate mb-1">{product.name}</h4>
                                                <div className="flex items-baseline gap-2 flex-wrap">
                                                    {productPricing.hasDiscount && (
                                                        <span className="text-sm text-gray-400 line-through">
                                                            ₱{productPricing.originalPrice.toLocaleString()}
                                                        </span>
                                                    )}
                                                    <p className="text-lg font-bold text-theme-accent">
                                                        ₱{productPricing.price.toLocaleString()}
                                                        {product.variations && product.variations.length > 1 && (
                                                            <span className="text-xs text-gray-500 font-normal ml-1">starting</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleAddToCart(product)}
                                            disabled={addedToCart.has(product.id)}
                                            className={`w-full py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all ${addedToCart.has(product.id)
                                                ? 'bg-green-500 text-white'
                                                : 'bg-navy-900 text-white hover:bg-navy-800'
                                                }`}
                                        >
                                            <ShoppingCart className="w-4 h-4" />
                                            {addedToCart.has(product.id) ? 'Added to Cart!' : 'Add to Cart'}
                                        </button>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </article>

                {/* Back Button (Bottom) */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => navigate('/peptalk')}
                        className="inline-flex items-center gap-2 bg-navy-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-navy-800 transition-colors shadow-md hover:shadow-lg"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Peptalk
                    </button>
                </div>
            </div>
        </div>
    );
}
