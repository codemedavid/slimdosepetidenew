import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Save, X, ArrowLeft, TrendingUp, Package, Users, FolderOpen, CreditCard, Sparkles, Layers, Shield, RefreshCw, Warehouse, ShoppingCart, HelpCircle, MapPin, Settings, Tag, BookOpen, MessageSquare } from 'lucide-react';
import type { Product, ProductBundleTier } from '../types';
import { supabase } from '../lib/supabase';
import { useMenu } from '../hooks/useMenu';
import { useCategories } from '../hooks/useCategories';
import ImageUpload from './ImageUpload';
import CategoryManager from './CategoryManager';
import PaymentMethodManager from './PaymentMethodManager';
import VariationManager from './VariationManager';
import COAManager from './COAManager';
import PeptideInventoryManager from './PeptideInventoryManager';
import OrdersManager from './OrdersManager';
import FAQManager from './FAQManager';
import ShippingManager from './ShippingManager';
import SiteSettingsManager from './SiteSettingsManager';
import PromoCodeManager from './PromoCodeManager';
import GlobalDiscountManager from './GlobalDiscountManager';
import GuideManager from './GuideManager';
import SalesAnalyticsManager from './SalesAnalyticsManager';
import PopupManager from './PopupManager';
import { Calendar, BarChart3 } from 'lucide-react';
const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const { products, loading, addProduct, updateProduct, deleteProduct, refreshProducts } = useMenu();
  const { categories } = useCategories();
  const [currentView, setCurrentView] = useState<'dashboard' | 'products' | 'add' | 'edit' | 'categories' | 'payments' | 'inventory' | 'orders' | 'shipping' | 'coa' | 'faq' | 'settings' | 'promo-codes' | 'global-discount' | 'guides' | 'analytics' | 'popup'>('dashboard');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [managingVariationsProductId, setManagingVariationsProductId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const variationManagerProduct = managingVariationsProductId
    ? products.find((product) => product.id === managingVariationsProductId) || null
    : null;

  const variationManagerModal = variationManagerProduct ? (
    <VariationManager
      product={variationManagerProduct}
      onClose={() => setManagingVariationsProductId(null)}
    />
  ) : null;

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    slug: '',
    description: '',
    base_price: 0,
    raw_price: 0,
    category: 'research',
    featured: false,
    available: true,
    purity_percentage: 99.0,
    molecular_weight: '',
    cas_number: '',
    sequence: '',
    storage_conditions: 'Store at -20°C',
    stock_quantity: 0,
    image_url: null,
    safety_sheet_url: null,
    coa_url: null,
    discount_active: false,
    inclusions: null
  });

  type BundleTierDraft = { id?: string; min_quantity: number; discount_percentage: number; active: boolean; most_popular: boolean };
  const [bundleTiers, setBundleTiers] = useState<BundleTierDraft[]>([]);

  // Load existing bundle tiers when editing a product
  useEffect(() => {
    if (currentView !== 'edit' || !editingProduct) {
      if (currentView === 'add') setBundleTiers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('product_bundle_tiers')
        .select('*')
        .eq('product_id', editingProduct.id)
        .order('min_quantity', { ascending: true });
      if (cancelled) return;
      setBundleTiers(
        ((data as ProductBundleTier[]) ?? []).map((t) => ({
          id: t.id,
          min_quantity: t.min_quantity,
          discount_percentage: Number(t.discount_percentage),
          active: t.active,
          most_popular: t.most_popular ?? false,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [currentView, editingProduct]);

  const slugify = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const persistBundleTiers = async (productId: string) => {
    // Replace strategy: delete tiers no longer present, upsert the rest
    const { data: existing } = await supabase
      .from('product_bundle_tiers')
      .select('id')
      .eq('product_id', productId);
    const existingIds = new Set(((existing as { id: string }[]) ?? []).map((t) => t.id));
    const keepIds = new Set(bundleTiers.filter((t) => t.id).map((t) => t.id as string));
    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from('product_bundle_tiers').delete().in('id', toDelete);
    }
    if (bundleTiers.length > 0) {
      // Enforce only one most_popular row at a time
      let popularSeen = false;
      const rows = bundleTiers.map((t) => {
        const mp = t.most_popular && !popularSeen;
        if (mp) popularSeen = true;
        return {
          ...(t.id ? { id: t.id } : {}),
          product_id: productId,
          min_quantity: Math.max(2, Math.floor(t.min_quantity)),
          discount_percentage: Number(t.discount_percentage),
          active: t.active,
          most_popular: mp,
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await supabase
        .from('product_bundle_tiers')
        .upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
  };

  const handleAddProduct = () => {
    setCurrentView('add');
    setSelectedProducts(new Set());
    setManagingVariationsProductId(null);
    const defaultCategory = categories.length > 0 ? categories[0].id : 'research';
    setFormData({
      name: '',
      description: '',
      base_price: 0,
      category: defaultCategory,
      featured: false,
      available: true,
      purity_percentage: 99.0,
      molecular_weight: '',
      cas_number: '',
      sequence: '',
      storage_conditions: 'Store at -20°C',
      stock_quantity: 0,
      image_url: null,
      safety_sheet_url: null,
      discount_active: false,
      inclusions: null
    });
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setCurrentView('edit');
    setSelectedProducts(new Set());
    setManagingVariationsProductId(null);
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      setManagingVariationsProductId(null);
      try {
        setIsProcessing(true);
        const result = await deleteProduct(id);
        if (!result.success) {
          alert(result.error || 'Failed to delete product');
        }
      } catch (error) {
        alert('Failed to delete product. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) {
      alert('Please select products to delete');
      return;
    }

    if (confirm(`Are you sure you want to delete ${selectedProducts.size} product(s)? This action cannot be undone.`)) {
      try {
        setIsProcessing(true);
        let successCount = 0;
        let failedCount = 0;

        for (const productId of selectedProducts) {
          const result = await deleteProduct(productId);
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        }

        if (failedCount > 0) {
          alert(`Deleted ${successCount} product(s). ${failedCount} failed.`);
        } else {
          alert(`Successfully deleted ${successCount} product(s)`);
        }

        setSelectedProducts(new Set());
        setManagingVariationsProductId(null);
      } catch (error) {
        alert('Failed to delete products. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };


  const toggleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
      setManagingVariationsProductId(null);
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.description || !formData.base_price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setIsProcessing(true);

      // Default slug from name if not provided
      if (!formData.slug || !formData.slug.trim()) {
        formData.slug = slugify(formData.name || '');
      }

      // Prepare data for saving - convert undefined to null for nullable fields
      const prepareData = (data: Partial<Product>) => {
        const prepared = { ...data };
        // Convert undefined to null for nullable fields
        if (prepared.image_url === undefined) prepared.image_url = null;
        if (prepared.safety_sheet_url === undefined) prepared.safety_sheet_url = null;
        if (prepared.coa_url === undefined) prepared.coa_url = null;
        if (prepared.discount_price === undefined) prepared.discount_price = null;
        if (prepared.molecular_weight === undefined) prepared.molecular_weight = null;
        if (prepared.cas_number === undefined) prepared.cas_number = null;
        if (prepared.sequence === undefined) prepared.sequence = null;
        if (prepared.inclusions === undefined) prepared.inclusions = null;
        return prepared;
      };

      // Only send columns that actually exist in the `products` table
      const pickProductDbFields = (data: Partial<Product>) => {
        const allowedKeys: (keyof Product)[] = [
          'name',
          'slug',
          'description',
          'category',
          'base_price',
          'raw_price',
          'discount_price',
          'discount_active',
          'purity_percentage',
          'molecular_weight',
          'cas_number',
          'sequence',
          'storage_conditions',
          'stock_quantity',
          'available',
          'featured',
          'image_url',
          'safety_sheet_url',
          'coa_url',
        ];

        const dbPayload: Partial<Product> = {};
        for (const key of allowedKeys) {
          if (key in data) {
            // @ts-expect-error index by key
            dbPayload[key] = data[key];
          }
        }
        return dbPayload;
      };

      if (editingProduct) {
        // Remove read-only fields and relations before updating
        const { id, created_at, updated_at, variations, ...updateData } = formData as Product;

        // EXPLICITLY ensure image_url is included (even if it's null/undefined)
        // Get image_url directly from formData to ensure we have the latest value
        const imageUrlValue = formData.image_url !== undefined ? formData.image_url : null;

        // Create update payload - ensure image_url is always included
        const updatePayload: any = {
          ...updateData,
        };

        // ALWAYS explicitly set image_url, even if it's null
        updatePayload.image_url = imageUrlValue;

        const preparedData = prepareData(updatePayload);

        // Triple-check: Force image_url to be in the payload
        preparedData.image_url = imageUrlValue;

        // Strip out any fields that don't exist on the products table
        const dbPayload = pickProductDbFields(preparedData);

        // Log to verify it's included
        console.log('🔍 Final payload check:', {
          has_image_url: 'image_url' in dbPayload,
          image_url_value: dbPayload.image_url,
          image_url_type: typeof dbPayload.image_url,
          all_keys: Object.keys(dbPayload)
        });

        console.log('💾 Saving product update:', {
          id: editingProduct.id,
          image_url: dbPayload.image_url,
          image_url_type: typeof dbPayload.image_url,
          image_url_length: dbPayload.image_url?.length || 0,
          fullPayload: dbPayload
        });

        const result = await updateProduct(editingProduct.id, dbPayload);
        if (!result.success) {
          console.error('❌ Update failed:', result.error);
          throw new Error(result.error || 'Failed to update product');
        }

        try {
          await persistBundleTiers(editingProduct.id);
        } catch (e) {
          console.error('❌ Bundle tier save failed:', e);
          alert(`Product saved but bundle tier update failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }

        // Verify the image was saved
        if (result.data && result.data.image_url !== preparedData.image_url) {
          console.warn('⚠️ Image URL mismatch after save:', {
            sent: preparedData.image_url,
            received: result.data.image_url
          });
        }

        console.log('✅ Product updated successfully', {
          saved_image_url: result.data?.image_url
        });
      } else {
        // Remove non-creatable fields for new products
        const { variations, ...createData } = formData as any;

        // EXPLICITLY ensure image_url is included
        const createPayload = {
          ...createData,
          image_url: formData.image_url !== undefined ? formData.image_url : null,
        };

        const preparedData = prepareData(createPayload);

        // Strip out any fields that don't exist on the products table for insert
        const dbPayload = pickProductDbFields(preparedData);
        console.log('💾 Creating new product:', {
          name: dbPayload.name,
          image_url: dbPayload.image_url,
          fullPayload: dbPayload
        });

        const result = await addProduct(dbPayload as Omit<Product, 'id' | 'created_at' | 'updated_at'>);
        if (!result.success) {
          throw new Error(result.error);
        }
        console.log('✅ Product created successfully');

        if (result.data?.id && bundleTiers.length > 0) {
          try {
            await persistBundleTiers(result.data.id);
          } catch (e) {
            console.error('❌ Bundle tier save failed:', e);
            alert(`Product created but bundle tier save failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }
      }

      // Refresh products to ensure UI is updated
      console.log('🔄 Refreshing products after save...');
      await refreshProducts();
      console.log('✅ Products refreshed');

      // If we were editing, verify the image was saved
      if (editingProduct && formData.image_url) {
        console.log('🔍 Verifying saved image URL:', formData.image_url);
        // The refresh should have updated the products list with the new image
      }

      setCurrentView('products');
      setEditingProduct(null);
      setManagingVariationsProductId(null);
    } catch (error) {
      console.error('❌ Error saving product:', error);
      alert(`Failed to save product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setCurrentView(currentView === 'add' || currentView === 'edit' ? 'products' : 'dashboard');
    setEditingProduct(null);
    setManagingVariationsProductId(null);
  };

  // Dashboard Stats
  const totalProducts = products.length;
  const featuredProducts = products.filter(p => p.featured).length;
  const availableProducts = products.filter(p => p.available).length;
  const categoryCounts = categories.map(cat => ({
    ...cat,
    count: products.filter(p => p.category === cat.id).length
  }));

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'SLMDOSE2026') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setCurrentView('dashboard');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProducts();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-soft p-6 md:p-8 w-full max-w-md border border-charcoal-100">
          <div className="text-center mb-6">
            <div className="relative mx-auto w-16 h-16 rounded-full overflow-hidden mb-4 border-2 border-theme-accent/30">
              <img
                src="/assets/logo.jpeg"
                alt="SlimDose Peptides"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-2xl font-bold text-theme-text mb-1">Admin Access</h1>
            <p className="text-sm text-gray-500">
              Enter password to continue
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-charcoal-100 rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent transition-colors"
                placeholder="Enter admin password"
                required
              />
              {loginError && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  ❌ {loginError}
                </p>
              )}
            </div>

            <button type="submit" className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg">
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-charcoal-100 border-t-theme-accent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Form View (Add/Edit)
  if (currentView === 'add' || currentView === 'edit') {
    return (
      <>
        {variationManagerModal}
        <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white">
          <div className="bg-white shadow-md border-b border-gray-200">
            <div className="max-w-6xl mx-auto px-3 sm:px-4">
              <div className="flex items-center justify-between h-12 md:h-14 gap-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCancel}
                    className="text-gray-700 hover:text-theme-accent transition-colors flex items-center gap-1 group"
                  >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs md:text-sm">Back</span>
                  </button>
                  <h1 className="text-sm md:text-base font-bold text-brand-500">
                    {currentView === 'add' ? '✨ Add New' : '✏️ Edit Product'}
                  </h1>
                </div>
                <div className="flex space-x-1.5">
                  <button onClick={handleCancel} className="px-2 py-1 border border-gray-300 hover:border-gray-400 rounded-md hover:bg-gray-50 transition-all flex items-center gap-1 text-xs">
                    <X className="h-3 w-3" />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                  <button
                    onClick={handleSaveProduct}
                    disabled={isProcessing}
                    className="bg-theme-accent hover:bg-theme-accent/90 text-white px-2 md:px-3 py-1 rounded-md transition-all flex items-center gap-1 shadow-sm hover:shadow disabled:opacity-50 text-xs"
                  >
                    <Save className="h-3 w-3" />
                    {isProcessing ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 md:py-4">
            <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-3 md:p-4 lg:p-5 space-y-3 md:space-y-4 border border-gray-200">
              {/* Basic Information */}
              <div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-1.5">
                  <span className="text-base md:text-lg">📝</span>
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Product Name *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setFormData((prev) => {
                          const autoSlug = !prev.slug || prev.slug === slugify(prev.name || '');
                          return {
                            ...prev,
                            name: newName,
                            slug: autoSlug ? slugify(newName) : prev.slug,
                          };
                        });
                      }}
                      className="input-field text-sm"
                      placeholder="e.g., BPC-157 5mg"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">URL Slug</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 whitespace-nowrap">/</span>
                      <input
                        type="text"
                        value={formData.slug || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, slug: slugify(e.target.value) })
                        }
                        className="input-field text-sm"
                        placeholder="bpc-157-5mg"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Auto-generated from the name. Edit to customize the product URL.
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description *</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input-field text-sm"
                      placeholder="Detailed product description..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
                    <select
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="input-field text-sm"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Base Price (₱) *</label>
                    <input
                      type="number"
                      step="1"
                      value={formData.base_price || ''}
                      onChange={(e) => setFormData({ ...formData, base_price: Number(e.target.value) })}
                      className="input-field text-sm"
                      placeholder="0"
                    />
                    {editingProduct && editingProduct.variations && editingProduct.variations.length > 0 && (
                      <p className="text-xs text-orange-600 mt-2 flex items-start gap-1.5 bg-orange-50 p-2 rounded border border-orange-200">
                        <span className="text-base">⚠️</span>
                        <span>This product has <strong>{editingProduct.variations.length} size variation(s)</strong>. Customers will see those prices instead of this base price. Use the <strong>"Manage Sizes"</strong> button to update the prices shown on the website.</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Raw Price (₱)</label>
                    <input
                      type="number"
                      step="1"
                      value={formData.raw_price ?? ''}
                      onChange={(e) => setFormData({ ...formData, raw_price: Number(e.target.value) })}
                      className="input-field text-sm"
                      placeholder="0"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Wholesale / unit cost. Used in Sales Analytics to compute profit when a variation has no cost price.
                    </p>
                    {formData.base_price && formData.raw_price ? (
                      <p className="text-[11px] text-emerald-700 mt-1">
                        Margin: ₱{(Number(formData.base_price) - Number(formData.raw_price)).toLocaleString()} ({(((Number(formData.base_price) - Number(formData.raw_price)) / Number(formData.base_price)) * 100).toFixed(1)}%)
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Scientific Details */}
              <div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-1.5">
                  <span className="text-base md:text-lg">🧪</span>
                  Scientific Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Purity (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.purity_percentage || ''}
                      onChange={(e) => setFormData({ ...formData, purity_percentage: Number(e.target.value) })}
                      className="input-field text-sm"
                      placeholder="99.0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Molecular Weight</label>
                    <input
                      type="text"
                      value={formData.molecular_weight || ''}
                      onChange={(e) => setFormData({ ...formData, molecular_weight: e.target.value })}
                      className="input-field text-sm"
                      placeholder="e.g., 1419.55 g/mol"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">CAS Number</label>
                    <input
                      type="text"
                      value={formData.cas_number || ''}
                      onChange={(e) => setFormData({ ...formData, cas_number: e.target.value })}
                      className="input-field text-sm"
                      placeholder="e.g., 137525-51-0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Storage Conditions</label>
                    <input
                      type="text"
                      value={formData.storage_conditions || ''}
                      onChange={(e) => setFormData({ ...formData, storage_conditions: e.target.value })}
                      className="input-field text-sm"
                      placeholder="Store at -20°C"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Sequence</label>
                    <input
                      type="text"
                      value={formData.sequence || ''}
                      onChange={(e) => setFormData({ ...formData, sequence: e.target.value })}
                      className="input-field text-sm"
                      placeholder="e.g., GEPPPGKPADDAGLV"
                    />
                  </div>
                </div>
              </div>

              {/* Complete Set Inclusions */}
              <div className="bg-gradient-to-r from-gold-50 to-gray-50 border border-gray-200 rounded-lg p-3 md:p-4">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <h3 className="text-sm md:text-base font-bold text-gray-900 flex items-center gap-1.5">
                    <span className="text-base md:text-lg">📦</span>
                    Complete Set Inclusions
                  </h3>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.inclusions !== null && formData.inclusions !== undefined}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setFormData({ ...formData, inclusions: null });
                        } else {
                          setFormData({ ...formData, inclusions: formData.inclusions || [] });
                        }
                      }}
                      className="w-4 h-4 text-theme-accent rounded focus:ring-theme-accent"
                    />
                    <span className="text-xs font-semibold text-gray-700">This is a SET product</span>
                  </label>
                </div>
                {formData.inclusions !== null && formData.inclusions !== undefined ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      What's included in this set? (One item per line)
                    </label>
                    <textarea
                      value={formData.inclusions?.join('\n') || ''}
                      onChange={(e) => {
                        const items = e.target.value.split('\n').filter(item => item.trim() !== '');
                        setFormData({ ...formData, inclusions: items.length > 0 ? items : null });
                      }}
                      className="input-field text-sm min-h-[80px]"
                      placeholder="Example:&#10;Syringe for Reconstitution&#10;6 Insulin Syringes (7pcs for 30mg)&#10;10pcs Alcohol Pads&#10;Tirzepatide Printed Guide&#10;Transparent vial case and vial cap&#10;Peptide Injection and Inventory Spreadsheet tracker"
                      rows={6}
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-start gap-1.5">
                      <span className="text-theme-accent font-bold">💡</span>
                      <span>Enter each item on a new line. These will be displayed as a checklist on the product detail page. Check "This is a SET product" above to enable this feature.</span>
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-500 mb-2">Enable "This is a SET product" to add inclusions</p>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, inclusions: [] })}
                      className="text-xs text-theme-accent hover:text-gold-700 font-medium"
                    >
                      Enable SET feature
                    </button>
                  </div>
                )}
              </div>

              {/* Inventory */}
              <div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-1.5">
                  <span className="text-base md:text-lg">📦</span>
                  Inventory & Availability
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      value={formData.stock_quantity || ''}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: Number(e.target.value) })}
                      className="input-field text-sm"
                      placeholder="0"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 pt-0 sm:pt-6">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.featured || false}
                        onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                        className="w-4 h-4 text-theme-accent rounded focus:ring-theme-accent"
                      />
                      <span className="text-xs font-semibold text-gray-700">⭐ Featured</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.available ?? true}
                        onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-xs font-semibold text-gray-700">✅ Available</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Discount */}
              <div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-1.5">
                  <span className="text-base md:text-lg">💰</span>
                  Discount Pricing
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Discount Price (₱)</label>
                    <input
                      type="number"
                      step="1"
                      value={formData.discount_price || ''}
                      onChange={(e) => setFormData({ ...formData, discount_price: Number(e.target.value) || null })}
                      className="input-field text-sm"
                      placeholder="0"
                    />
                  </div>

                  <div className="flex items-center pt-0 md:pt-6">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.discount_active || false}
                        onChange={(e) => setFormData({ ...formData, discount_active: e.target.checked })}
                        className="w-4 h-4 text-red-600 rounded focus:ring-theme-accent"
                      />
                      <span className="text-xs font-semibold text-gray-700">🏷️ Enable Discount</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Product Image */}
              <div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-1.5">
                  <span className="text-base md:text-lg">🖼️</span>
                  Product Image
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  Upload a product image (optional). This will appear on the customer-facing site.
                </p>
                <ImageUpload
                  currentImage={formData.image_url || undefined}
                  onImageChange={(imageUrl) => {
                    // Normalize value: undefined/null → null, non-empty string → trimmed URL
                    let newImageUrl: string | null = null;
                    if (imageUrl) {
                      const trimmed = imageUrl.trim();
                      newImageUrl = trimmed === '' ? null : trimmed;
                    }

                    setFormData((prev) => ({
                      ...prev,
                      image_url: newImageUrl,
                    }));

                    console.log('🖼️ Product image updated in formData:', {
                      original: imageUrl,
                      saved: newImageUrl,
                    });
                  }}
                />
              </div>

              {/* Certificate of Analysis (CoA) */}
              <div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-1.5">
                  <span className="text-base md:text-lg">📄</span>
                  Certificate of Analysis (COA)
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  Paste the COA URL (PDF or image link). Renders inline on the product page and as a "View COA" button beside Add to Cart.
                </p>
                <input
                  type="url"
                  value={formData.coa_url || ''}
                  onChange={(e) => {
                    const trimmed = e.target.value.trim();
                    setFormData({ ...formData, coa_url: trimmed === '' ? null : trimmed });
                  }}
                  className="input-field text-sm"
                  placeholder="https://example.com/coa.pdf"
                />
                {formData.coa_url && (
                  <a
                    href={formData.coa_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs font-semibold text-theme-accent hover:underline"
                  >
                    Open COA link ↗
                  </a>
                )}
              </div>

              {/* Bundle Discounts */}
              <div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-1.5">
                  <span className="text-base md:text-lg">🎁</span>
                  Bundle Discounts (per-product quantity)
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  Auto-applied when a customer buys 2 or more of this product. Highest matching tier wins. Bundle discount can't be combined with promo codes.
                </p>

                <div className="space-y-2">
                  {bundleTiers.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No bundle tiers — add one to enable bundle discounts.</p>
                  )}
                  {bundleTiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Min quantity</label>
                          <input
                            type="number"
                            min={2}
                            value={tier.min_quantity}
                            onChange={(e) => {
                              const v = Math.max(2, Number(e.target.value) || 2);
                              setBundleTiers(bundleTiers.map((t, i) => (i === idx ? { ...t, min_quantity: v } : t)));
                            }}
                            className="input-field text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Discount %</label>
                          <input
                            type="number"
                            min={0.1}
                            max={100}
                            step="0.1"
                            value={tier.discount_percentage}
                            onChange={(e) => {
                              const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                              setBundleTiers(bundleTiers.map((t, i) => (i === idx ? { ...t, discount_percentage: v } : t)));
                            }}
                            className="input-field text-sm"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={tier.active}
                          onChange={(e) =>
                            setBundleTiers(bundleTiers.map((t, i) => (i === idx ? { ...t, active: e.target.checked } : t)))
                          }
                        />
                        Active
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={tier.most_popular}
                          onChange={(e) =>
                            setBundleTiers(bundleTiers.map((t, i) => ({
                              ...t,
                              most_popular: i === idx ? e.target.checked : false,
                            })))
                          }
                        />
                        Most Popular
                      </label>
                      <button
                        type="button"
                        onClick={() => setBundleTiers(bundleTiers.filter((_, i) => i !== idx))}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        title="Remove tier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextMin = bundleTiers.length === 0
                      ? 2
                      : Math.max(...bundleTiers.map((t) => t.min_quantity)) + 1;
                    setBundleTiers([...bundleTiers, { min_quantity: nextMin, discount_percentage: 5, active: true, most_popular: false }]);
                  }}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add bundle tier
                </button>
              </div>

            </div>
          </div>
        </div>
      </>
    );
  }

  // Products List View
  if (currentView === 'products') {
    const ACCENT = '#3C6CA8';
    const ACCENT_DARK = '#264874';
    const CREAM = '#FFFCF6';
    return (
      <>
        {variationManagerModal}
        <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
          {/* Top bar */}
          <div className="bg-white border-b border-charcoal-100 sticky top-0 z-30">
            <div className="max-w-6xl mx-auto px-3 sm:px-5">
              <div className="flex items-center justify-between h-14">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="flex items-center gap-1.5 text-charcoal-500 transition-colors group"
                    style={{ ['--hover-color' as string]: ACCENT }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = ACCENT; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = ''; }}
                  >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs md:text-sm font-medium">Dashboard</span>
                  </button>
                  <span className="h-5 w-px bg-charcoal-200" />
                  <h1 className="text-sm md:text-base font-bold tracking-tight" style={{ color: ACCENT }}>Products</h1>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={{ backgroundColor: CREAM, color: ACCENT, borderColor: '#C2D4EA' }}>
                    {products.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full font-semibold text-xs text-charcoal-700 bg-white border border-charcoal-200 hover:border-brand-400 hover:text-brand-600 transition-all disabled:opacity-50"
                    title="Refresh data"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                  {selectedProducts.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={isProcessing}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full font-semibold text-xs text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="hidden sm:inline">Delete ({selectedProducts.size})</span>
                      <span className="sm:hidden">{selectedProducts.size}</span>
                    </button>
                  )}
                  <button
                    onClick={handleAddProduct}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full font-semibold text-xs text-white transition-all"
                    style={{ backgroundColor: ACCENT, boxShadow: '0 2px 8px rgba(60, 108, 168, 0.25)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = ACCENT_DARK; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ACCENT; }}
                  >
                    <Plus className="h-3 w-3" />
                    <span className="hidden sm:inline">Add New</span>
                    <span className="sm:hidden">Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 md:py-6">
            {/* Selection Info Banner */}
            {selectedProducts.size > 0 && (
              <div
                className="mb-4 rounded-xl p-3 flex items-center justify-between border"
                style={{ backgroundColor: '#F2F6FB', borderColor: '#C2D4EA' }}
              >
                <span className="text-xs md:text-sm font-semibold" style={{ color: ACCENT_DARK }}>
                  {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedProducts(new Set())}
                  className="text-xs font-semibold underline hover:no-underline"
                  style={{ color: ACCENT }}
                >
                  Clear Selection
                </button>
              </div>
            )}

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {products.map((product) => {
                const isSelected = selectedProducts.has(product.id);
                const hasSizes = !!(product.variations && product.variations.length > 0);
                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border p-3 transition-all"
                    style={{
                      borderColor: isSelected ? ACCENT : '#EFEFEF',
                      boxShadow: isSelected ? '0 4px 14px rgba(60, 108, 168, 0.10)' : '0 1px 3px rgba(20, 35, 60, 0.04)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(product.id)}
                          className="mt-1 w-4 h-4 rounded cursor-pointer shrink-0"
                          style={{ accentColor: ACCENT }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-charcoal-900 truncate">{product.name}</h3>
                          <p className="text-[11px] text-charcoal-500 line-clamp-2 mt-0.5">{product.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setManagingVariationsProductId(product.id); }}
                          disabled={isProcessing}
                          className="p-1.5 rounded-lg transition-all disabled:opacity-50"
                          style={hasSizes
                            ? { backgroundColor: ACCENT, color: '#FFFFFF' }
                            : { backgroundColor: CREAM, color: ACCENT, border: '1px solid #C2D4EA' }}
                          title="Manage Sizes"
                        >
                          <Layers className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditProduct(product)}
                          disabled={isProcessing}
                          className="p-1.5 text-charcoal-700 hover:bg-cream-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          disabled={isProcessing}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-charcoal-100">
                      <div className="grid grid-cols-3 gap-3 flex-1">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold">Price</div>
                          <div className="text-sm font-bold text-charcoal-900 mt-0.5">
                            ₱{product.base_price.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold">Stock</div>
                          <div className="text-sm font-semibold text-charcoal-900 mt-0.5">{product.stock_quantity}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold">Sizes</div>
                          <div className="text-sm font-semibold mt-0.5" style={{ color: ACCENT }}>{product.variations?.length || 0}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        {product.featured && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: CREAM, color: ACCENT, border: '1px solid #C2D4EA' }}>★</span>
                        )}
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                          style={product.available
                            ? { backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
                            : { backgroundColor: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' }}
                        >
                          {product.available ? 'Active' : 'Off'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-2xl overflow-hidden border border-charcoal-100 shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ backgroundColor: CREAM, borderBottom: '1px solid #EFEFEF' }}>
                    <tr>
                      <th className="px-3 py-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={selectedProducts.size === products.length && products.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded cursor-pointer"
                          style={{ accentColor: ACCENT }}
                          title="Select All"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-500">Product</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-500 hidden lg:table-cell">Category</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-500">Price</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-500">Sizes</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-500">Purity</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-500">Stock</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-500 hidden xl:table-cell">Status</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal-100">
                    {products.map((product) => {
                      const isSelected = selectedProducts.has(product.id);
                      const hasSizes = !!(product.variations && product.variations.length > 0);
                      return (
                        <tr
                          key={product.id}
                          className="transition-colors"
                          style={isSelected ? { backgroundColor: '#F2F6FB' } : undefined}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#FBF6EA'; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = ''; }}
                        >
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectProduct(product.id)}
                              className="w-4 h-4 rounded cursor-pointer"
                              style={{ accentColor: ACCENT }}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-charcoal-900">{product.name}</div>
                            <div className="text-[11px] text-charcoal-500 truncate max-w-xs mt-0.5">{product.description}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-charcoal-600 hidden lg:table-cell">
                            {categories.find(cat => cat.id === product.category)?.name || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-bold text-charcoal-900">
                              ₱{product.base_price.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                            {hasSizes && (
                              <div className="text-[9px] font-medium mt-0.5" style={{ color: ACCENT }}>
                                Per-size pricing
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {hasSizes ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border"
                                style={{ backgroundColor: CREAM, color: ACCENT, borderColor: '#C2D4EA' }}
                              >
                                {product.variations!.length} {product.variations!.length === 1 ? 'size' : 'sizes'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-charcoal-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-charcoal-50 text-charcoal-700 border border-charcoal-100">
                              {product.purity_percentage}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-charcoal-900">
                            {product.stock_quantity}
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <div className="flex flex-col gap-1">
                              {product.featured && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border w-fit"
                                  style={{ backgroundColor: CREAM, color: ACCENT, borderColor: '#C2D4EA' }}
                                >
                                  ★ Featured
                                </span>
                              )}
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit"
                                style={product.available
                                  ? { backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
                                  : { backgroundColor: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' }}
                              >
                                {product.available ? 'Active' : 'Off'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setManagingVariationsProductId(product.id); }}
                                disabled={isProcessing}
                                className="p-1.5 rounded-lg transition-all disabled:opacity-50"
                                style={hasSizes
                                  ? { backgroundColor: ACCENT, color: '#FFFFFF' }
                                  : { color: ACCENT, backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => {
                                  if (hasSizes) e.currentTarget.style.backgroundColor = ACCENT_DARK;
                                  else e.currentTarget.style.backgroundColor = CREAM;
                                }}
                                onMouseLeave={(e) => {
                                  if (hasSizes) e.currentTarget.style.backgroundColor = ACCENT;
                                  else e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Manage Sizes"
                              >
                                <Layers className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleEditProduct(product)}
                                disabled={isProcessing}
                                className="p-1.5 text-charcoal-700 hover:bg-cream-100 rounded-lg transition-colors disabled:opacity-50"
                                title="Edit"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                disabled={isProcessing}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {products.length === 0 && (
              <div className="bg-white rounded-2xl border border-charcoal-100 shadow-soft p-12 text-center mt-4">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: CREAM }}>
                  <Plus className="w-7 h-7" style={{ color: ACCENT }} />
                </div>
                <h3 className="text-base font-bold text-charcoal-900 mb-1">No products yet</h3>
                <p className="text-sm text-charcoal-500 mb-4">Add your first product to get started.</p>
                <button
                  onClick={handleAddProduct}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-white text-sm font-semibold transition-all"
                  style={{ backgroundColor: ACCENT }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = ACCENT_DARK; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ACCENT; }}
                >
                  <Plus className="h-4 w-4" /> Add Product
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Categories View
  if (currentView === 'categories') {
    return <CategoryManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Payment Methods View
  if (currentView === 'payments') {
    return <PaymentMethodManager onBack={() => setCurrentView('dashboard')} />;
  }


  // Inventory View
  if (currentView === 'inventory') {
    return <PeptideInventoryManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Orders View
  if (currentView === 'orders') {
    return <OrdersManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Shipping View
  if (currentView === 'shipping') {
    return <ShippingManager onBack={() => setCurrentView('dashboard')} />;
  }

  // COA View
  if (currentView === 'coa') {
    return <COAManager onBack={() => setCurrentView('dashboard')} />;
  }

  // FAQ View
  if (currentView === 'faq') {
    return <FAQManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Promo Codes View
  if (currentView === 'promo-codes') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="mb-4 text-gray-600 hover:text-brand-600 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <PromoCodeManager />
        </div>
      </div>
    );
  }

  // Global Discount View
  if (currentView === 'global-discount') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="mb-4 text-gray-600 hover:text-brand-600 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <GlobalDiscountManager />
        </div>
      </div>
    );
  }

  // Smart Guides View
  if (currentView === 'guides') {
    return <GuideManager />;
  }

  // Analytics View
  if (currentView === 'analytics') {
    return <SalesAnalyticsManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Popup View
  if (currentView === 'popup') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="mb-4 text-gray-600 hover:text-brand-600 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <PopupManager />
        </div>
      </div>
    );
  }

  // Settings View
  if (currentView === 'settings') {
    // SiteSettingsManager doesn't seem to have onBack prop based on earlier view_file, 
    // checking its content... it has handleCancel but assumes rendered in place or manages its own state.
    // Looking at SiteSettingsManager.tsx line 251, it doesn't take props?
    // Wait, SiteSettingsManager.tsx as viewed in step 181 has no props defined in React.FC.
    // However, it has a back button logic internally? No, it has "Site Settings" header and Edit/Cancel buttons.
    // I should probably wrap it or modify it to support onBack if I want consistent UI.
    // For now I will wrap it in the standard layout style if needed, or just render it.
    // Given the dashboard structure, other managers take onBack. 
    // Let's assume for now I just render it, but I might need to make it comply with the layout.
    // Actually, looking at other managers they render full screen or modify view.
    // I'll render it and if it lacks a back button to dashboard, the user is stuck.
    // SiteSettingsManager from step 181 DOES NOT have a back button to main dashboard.
    // It has a "Cancel" button that exits edit mode.
    // I should wrap it or modify it. 
    // To match the requested speed, I'll modify AdminDashboard to render it with a manual Back button if needed, 
    // OR simply assume I'll fix SiteSettingsManager later.
    // BETTER: Render it inside the dashboard layout or add a wrapper here.
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="mb-4 text-gray-600 hover:text-brand-600 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <SiteSettingsManager />
        </div>
      </div>
    );
  }

  // Dashboard View
  return (
    <>
      {variationManagerModal}
      <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFCF6 100%)' }}>
        <div className="bg-white shadow-soft border-b border-charcoal-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-charcoal-100">
                  <img
                    src="/assets/logo.jpeg"
                    alt="SlimDose Peptides"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h1 className="text-base font-bold text-charcoal-900">
                    SlimDose Peptides
                  </h1>
                  <p className="text-xs text-charcoal-500">
                    Admin Dashboard
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-charcoal-600 hover:text-brand-600 transition-colors font-medium text-sm hidden sm:block"
                >
                  View Website
                </a>
                <button
                  onClick={handleLogout}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-full transition-colors font-medium text-sm shadow-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-4">

          {/* Inventory Stats */}
          <div className="mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4" style={{ color: '#3C6CA8' }}>
              <Calendar className="w-5 h-5" />
              Inventory Overview
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={() => setCurrentView('products')}
                className="bg-white rounded-xl shadow-soft hover:shadow-md transition-all p-4 border border-gray-100 text-left cursor-pointer"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-theme-accent/10 rounded-lg">
                    <Package className="h-4 w-4 text-theme-accent" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Total Products</p>
                    <p className="text-xl font-bold text-theme-text">{totalProducts}</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('products')}
                className="bg-white rounded-xl shadow-soft hover:shadow-md transition-all p-4 border border-gray-100 text-left cursor-pointer"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Available</p>
                    <p className="text-xl font-bold text-green-600">{availableProducts}</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('products')}
                className="bg-white rounded-xl shadow-soft hover:shadow-md transition-all p-4 border border-gray-100 text-left cursor-pointer"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-charcoal-500">Featured</p>
                    <p className="text-xl font-bold text-amber-600">{featuredProducts}</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('categories')}
                className="bg-white rounded-xl shadow-soft hover:shadow-md transition-all p-4 border border-gray-100 text-left cursor-pointer"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Categories</p>
                    <p className="text-xl font-bold text-blue-600">{categories.length}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-soft p-4 border border-gray-100">
              <h3 className="text-base font-bold text-theme-text mb-3">
                Quick Actions
              </h3>
              <div className="space-y-1">
                <button
                  onClick={handleAddProduct}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-navy-50 rounded-lg">
                    <Plus className="h-4 w-4 text-brand-500" />
                  </div>
                  <span className="text-sm font-medium text-brand-500">Add New Product</span>
                </button>
                <button
                  onClick={() => setCurrentView('products')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-navy-50 rounded-lg">
                    <Package className="h-4 w-4 text-brand-500" />
                  </div>
                  <span className="text-sm font-medium text-brand-500">Manage Products</span>
                </button>
                <button
                  onClick={() => setCurrentView('categories')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-blue-50 rounded-lg">
                    <FolderOpen className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Manage Categories</span>
                </button>
                <button
                  onClick={() => setCurrentView('payments')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-purple-50 rounded-lg">
                    <CreditCard className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Payment Methods</span>
                </button>
                <button
                  onClick={() => setCurrentView('inventory')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-orange-50 rounded-lg">
                    <Warehouse className="h-4 w-4 text-orange-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Peptide Inventory</span>
                </button>
                <button
                  onClick={() => setCurrentView('orders')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-navy-50 rounded-lg">
                    <ShoppingCart className="h-4 w-4 text-brand-500" />
                  </div>
                  <span className="text-sm font-medium text-brand-500">Orders Management</span>
                </button>
                <button
                  onClick={() => setCurrentView('analytics')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-theme-accent/10 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-theme-accent" />
                  </div>
                  <span className="text-sm font-medium text-theme-accent">Sales Analytics</span>
                </button>
                <button
                  onClick={() => setCurrentView('shipping')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-green-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Shipping Locations</span>
                </button>
                <button
                  onClick={() => setCurrentView('coa')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-navy-50 rounded-lg">
                    <Shield className="h-4 w-4 text-brand-500" />
                  </div>
                  <span className="text-sm font-medium text-brand-500">Lab Results (COA)</span>
                </button>
                <button
                  onClick={() => setCurrentView('faq')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-navy-50 rounded-lg">
                    <HelpCircle className="h-4 w-4 text-brand-500" />
                  </div>
                  <span className="text-sm font-medium text-brand-500">Manage FAQ</span>
                </button>
                <button
                  onClick={() => setCurrentView('promo-codes')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-green-50 rounded-lg">
                    <Tag className="h-4 w-4 text-green-700" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Promo Codes</span>
                </button>
                <button
                  onClick={() => setCurrentView('global-discount')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-red-50 rounded-lg">
                    <Sparkles className="h-4 w-4 text-red-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Global Discount</span>
                </button>
                <button
                  onClick={() => setCurrentView('guides')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-purple-50 rounded-lg">
                    <BookOpen className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Peptalk</span>
                </button>
                <button
                  onClick={() => setCurrentView('popup')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-pink-50 rounded-lg">
                    <MessageSquare className="h-4 w-4 text-pink-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Popup</span>
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="p-1.5 bg-gray-100 rounded-lg">
                    <Settings className="h-4 w-4 text-gray-700" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Site Settings</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-soft p-4 border border-gray-100">
              <h3 className="text-base font-bold text-theme-text mb-3">
                Categories Overview
              </h3>
              <div className="space-y-2">
                {categoryCounts.map((category, index) => {
                  const bgColors = [
                    'bg-theme-accent',
                    'bg-theme-secondary',
                    'bg-blue-500',
                    'bg-green-500',
                    'bg-purple-500',
                    'bg-orange-500'
                  ];
                  return (
                    <div key={category.id} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-all">
                      <span className="text-sm font-medium text-gray-700">{category.name}</span>
                      <span className={`text-xs font-bold text-white ${bgColors[index % bgColors.length]} px-2.5 py-1 rounded-full`}>
                        {category.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
