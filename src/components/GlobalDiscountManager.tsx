import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGlobalDiscountAdmin } from '../hooks/useGlobalDiscount';
import type { GlobalDiscount, Product } from '../types';
import { Plus, Trash2, Edit2, CheckCircle, XCircle, Percent, Search, X, AlertTriangle } from 'lucide-react';

const toIsoBoundary = (dateValue: string, boundary: 'start' | 'end') => {
  const timePart = boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999';
  return new Date(`${dateValue}${timePart}`).toISOString();
};

const isDateInPast = (isoString?: string | null) => {
  if (!isoString) return false;
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
};

const isDiscountExpired = (discount: Pick<GlobalDiscount, 'end_date'>) =>
  isDateInPast(discount.end_date);

const GlobalDiscountManager: React.FC = () => {
  const { discounts, loading, saveDiscount, deleteDiscount, toggleActive } = useGlobalDiscountAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<GlobalDiscount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');

  const [formData, setFormData] = useState<Partial<GlobalDiscount>>({
    name: '',
    discount_type: 'percentage',
    discount_value: 0,
    active: true,
    excluded_product_ids: [],
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, base_price, image_url, available')
      .eq('available', true)
      .order('name');
    if (data) setProducts(data as Product[]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.discount_value) {
      alert('Please fill in the discount name and value');
      return;
    }

    const result = await saveDiscount(
      editingDiscount ? { ...formData, id: editingDiscount.id } : formData
    );

    if (result.success) {
      setIsModalOpen(false);
      setEditingDiscount(null);
      resetForm();
      alert('Global discount saved successfully!');
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this global discount?')) return;
    const result = await deleteDiscount(id);
    if (!result.success) alert(`Error: ${result.error}`);
  };

  const handleToggleActive = async (discount: GlobalDiscount) => {
    const turningOn = !discount.active;
    if (turningOn && isDiscountExpired(discount)) {
      const endDate = discount.end_date ? new Date(discount.end_date).toLocaleDateString() : '';
      const proceed = confirm(
        `Heads up: this discount's end date (${endDate}) is already in the past, so customers won't see it even if you turn it on.\n\nEdit the discount and update the end date first. Activate anyway?`
      );
      if (!proceed) return;
    }
    await toggleActive(discount.id, turningOn);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      discount_type: 'percentage',
      discount_value: 0,
      active: true,
      excluded_product_ids: [],
    });
    setProductSearchQuery('');
  };

  const openModal = (discount?: GlobalDiscount) => {
    if (discount) {
      setEditingDiscount(discount);
      setFormData({
        name: discount.name,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        active: discount.active,
        start_date: discount.start_date,
        end_date: discount.end_date,
        excluded_product_ids: discount.excluded_product_ids || [],
      });
    } else {
      setEditingDiscount(null);
      resetForm();
    }
    setIsModalOpen(true);
  };

  const toggleExcludedProduct = (productId: string) => {
    const current = formData.excluded_product_ids || [];
    if (current.includes(productId)) {
      setFormData({ ...formData, excluded_product_ids: current.filter(id => id !== productId) });
    } else {
      setFormData({ ...formData, excluded_product_ids: [...current, productId] });
    }
  };

  const filteredDiscounts = discounts.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const excludedProducts = products.filter(p =>
    (formData.excluded_product_ids || []).includes(p.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Percent className="w-6 h-6 text-navy-900" />
          Global Discounts
        </h2>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-navy-900 text-white px-4 py-2 rounded-lg hover:bg-navy-800 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Global Discount
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Global discounts apply automatically to <strong>all products</strong> on the website.
          You can exclude specific products from the discount. Products with their own individual
          discount will use whichever discount is greater.
        </p>
      </div>

      {/* Discounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search discounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-navy-900 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold tracking-wider text-left">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Discount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Excluded</th>
                <th className="px-6 py-3">Date Range</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : filteredDiscounts.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No global discounts found. Create one to apply site-wide discounts.</td></tr>
              ) : (
                filteredDiscounts.map(discount => (
                  <tr key={discount.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-navy-900">{discount.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        {discount.discount_type === 'percentage'
                          ? `${discount.discount_value}% OFF`
                          : `₱${Number(discount.discount_value).toLocaleString()} OFF`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(discount)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            discount.active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {discount.active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {discount.active ? 'Active' : 'Inactive'}
                        </button>
                        {isDiscountExpired(discount) && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wide"
                            title="End date is in the past — customers won't see this discount even if Active."
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Expired
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {discount.excluded_product_ids?.length || 0} product(s)
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {discount.start_date || discount.end_date ? (
                        <div className="text-xs">
                          {discount.start_date && <div>From: {new Date(discount.start_date).toLocaleDateString()}</div>}
                          {discount.end_date && <div>Until: {new Date(discount.end_date).toLocaleDateString()}</div>}
                        </div>
                      ) : (
                        'No date limit'
                      )}
                    </td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button onClick={() => openModal(discount)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(discount.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingDiscount ? 'Edit Global Discount' : 'Create Global Discount'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Discount Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg placeholder-gray-400 focus:ring-2 focus:ring-navy-900 focus:border-transparent"
                  placeholder="e.g. Summer Sale, Grand Opening"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white"
                    value={formData.discount_type}
                    onChange={e => setFormData({ ...formData, discount_type: e.target.value as any })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₱)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value {formData.discount_type === 'percentage' ? '(%)' : '(₱)'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max={formData.discount_type === 'percentage' ? 100 : undefined}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={formData.discount_value || ''}
                    onChange={e => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date (optional)</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={formData.start_date ? formData.start_date.split('T')[0] : ''}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value ? toIsoBoundary(e.target.value, 'start') : undefined })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    className={`w-full px-4 py-2 border rounded-lg ${
                      isDateInPast(formData.end_date) ? 'border-red-400 bg-red-50' : 'border-gray-200'
                    }`}
                    value={formData.end_date ? formData.end_date.split('T')[0] : ''}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value ? toIsoBoundary(e.target.value, 'end') : undefined })}
                  />
                  {isDateInPast(formData.end_date) && (
                    <p className="mt-1.5 text-xs text-red-700 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      End date is in the past. Customers won't see this discount until you push it to a future date or clear it.
                    </p>
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active ?? true}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active (applies immediately)</span>
                </label>
              </div>

              {/* Excluded Products */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Excluded Products ({excludedProducts.length} excluded)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  These products will NOT receive the global discount. Search and click to toggle.
                </p>

                {/* Excluded chips */}
                {excludedProducts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {excludedProducts.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleExcludedProduct(p.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >
                        {p.name}
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Product search */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products to exclude..."
                    value={productSearchQuery}
                    onChange={e => setProductSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-navy-900 focus:border-transparent"
                  />
                </div>

                {/* Product list */}
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {filteredProducts.map(product => {
                    const isExcluded = (formData.excluded_product_ids || []).includes(product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => toggleExcludedProduct(product.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                          isExcluded
                            ? 'bg-red-50 hover:bg-red-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className={`font-medium ${isExcluded ? 'text-red-700' : 'text-gray-700'}`}>
                          {product.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isExcluded
                            ? 'bg-red-200 text-red-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {isExcluded ? 'Excluded' : 'Included'}
                        </span>
                      </button>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <div className="p-4 text-center text-sm text-gray-500">No products found</div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-navy-900 text-white rounded-lg font-bold hover:bg-navy-800 transition-colors shadow-lg shadow-navy-900/20"
                >
                  {editingDiscount ? 'Update Discount' : 'Create Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalDiscountManager;
