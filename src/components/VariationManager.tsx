import React, { useState } from 'react';
import { Plus, Edit, Trash2, Save, X, Package } from 'lucide-react';
import type { Product, ProductVariation } from '../types';
import { useMenu } from '../hooks/useMenu';

interface VariationManagerProps {
  product: Product;
  onClose: () => void;
}

const VariationManager: React.FC<VariationManagerProps> = ({ product, onClose }) => {
  const { addVariation, updateVariation, deleteVariation } = useMenu();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [newVariation, setNewVariation] = useState({
    name: '',
    quantity_mg: 5.0,
    price: product.base_price,
    cost_price: 0,
    discount_price: null as number | null,
    discount_active: false,
    stock_quantity: 0
  });

  const [editingVariation, setEditingVariation] = useState({
    name: '',
    quantity_mg: 5.0,
    price: product.base_price,
    cost_price: 0,
    discount_price: null as number | null,
    discount_active: false,
    stock_quantity: 0
  });

  const handleAddVariation = async () => {
    if (!newVariation.name || newVariation.price <= 0 || newVariation.quantity_mg <= 0) {
      alert('Please fill in all fields correctly');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await addVariation({
        product_id: product.id,
        name: newVariation.name,
        quantity_mg: newVariation.quantity_mg,
        price: newVariation.price,
        cost_price: newVariation.cost_price,
        discount_price: newVariation.discount_price,
        discount_active: newVariation.discount_active,
        stock_quantity: newVariation.stock_quantity
      });

      if (result.success) {
        setNewVariation({
          name: '',
          quantity_mg: 5.0,
          price: product.base_price,
          cost_price: 0,
          discount_price: null,
          discount_active: false,
          stock_quantity: 0
        });
        setIsAdding(false);
        alert('Variation added successfully!');
      } else {
        alert(result.error || 'Failed to add variation');
      }
    } catch (error) {
      alert('Failed to add variation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditVariation = (variation: ProductVariation) => {
    setEditingId(variation.id);
    setEditingVariation({
      name: variation.name,
      quantity_mg: variation.quantity_mg,
      price: variation.price,
      cost_price: variation.cost_price ?? 0,
      discount_price: variation.discount_price,
      discount_active: variation.discount_active,
      stock_quantity: variation.stock_quantity
    });
    setIsAdding(false);
  };

  const handleUpdateVariation = async () => {
    if (!editingId || !editingVariation.name || editingVariation.price <= 0 || editingVariation.quantity_mg <= 0) {
      alert('Please fill in all fields correctly');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await updateVariation(editingId, editingVariation);
      if (result.success) {
        setEditingId(null);
        alert('Variation updated successfully!');
      } else {
        alert(result.error || 'Failed to update variation');
      }
    } catch (error) {
      alert('Failed to update variation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteVariation = async (id: string, name: string) => {
    if (!confirm(`Delete ${name} variation? This cannot be undone.`)) return;

    try {
      setIsProcessing(true);
      const result = await deleteVariation(id);
      if (result.success) {
        alert('Variation deleted successfully!');
      } else {
        alert(result.error || 'Failed to delete variation');
      }
    } catch (error) {
      alert('Failed to delete variation');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6" />
                Manage Size Variations
              </h2>
              <p className="text-teal-100 mt-1">Product: {product.name}</p>
              <p className="text-teal-50 text-sm mt-2 bg-teal-700/30 px-3 py-1.5 rounded-lg inline-block">
                💡 <strong>These prices</strong> are what customers see on the website!
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Current Variations */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              Current Sizes
              <span className="text-sm font-normal text-gray-500">
                ({product.variations?.length || 0} variations)
              </span>
            </h3>

            {!product.variations || product.variations.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No size variations yet</p>
                <p className="text-sm text-gray-500 mt-1">Add your first size option below</p>
              </div>
            ) : (
              <div className="space-y-3">
                {product.variations.map((variation) => (
                  <div key={variation.id}>
                    {editingId === variation.id ? (
                      // Edit Mode
                      <div className="bg-white border-2 border-blue-300 rounded-xl p-4 space-y-4">
                        <h4 className="font-bold text-gray-900 mb-4">Edit Variation</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Size Name *
                            </label>
                            <input
                              type="text"
                              value={editingVariation.name}
                              onChange={(e) => setEditingVariation({ ...editingVariation, name: e.target.value })}
                              className="input-field"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Quantity (mg) *
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={editingVariation.quantity_mg}
                              onChange={(e) => setEditingVariation({ ...editingVariation, quantity_mg: parseFloat(e.target.value) || 0 })}
                              className="input-field"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Selling Price (₱) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editingVariation.price}
                              onChange={(e) => setEditingVariation({ ...editingVariation, price: parseFloat(e.target.value) || 0 })}
                              className="input-field"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Raw Cost (₱)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editingVariation.cost_price}
                              onChange={(e) => setEditingVariation({ ...editingVariation, cost_price: parseFloat(e.target.value) || 0 })}
                              className="input-field"
                              placeholder="Wholesale / supplier cost"
                            />
                            {editingVariation.price > 0 && editingVariation.cost_price > 0 && (
                              <p className="text-xs text-emerald-600 mt-1 font-medium">
                                Profit: ₱{(editingVariation.price - editingVariation.cost_price).toLocaleString()} ({(((editingVariation.price - editingVariation.cost_price) / editingVariation.price) * 100).toFixed(1)}%)
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Stock Quantity *
                            </label>
                            <input
                              type="number"
                              value={editingVariation.stock_quantity}
                              onChange={(e) => setEditingVariation({ ...editingVariation, stock_quantity: parseInt(e.target.value) || 0 })}
                              className="input-field"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Discount Price (₱)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editingVariation.discount_price || ''}
                              onChange={(e) => setEditingVariation({ ...editingVariation, discount_price: parseFloat(e.target.value) || null })}
                              className="input-field"
                              placeholder="Leave empty for no discount"
                            />
                          </div>

                          <div className="flex items-center pt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingVariation.discount_active}
                                onChange={(e) => setEditingVariation({
                                  ...editingVariation,
                                  discount_active: e.target.checked,
                                  discount_price: e.target.checked ? editingVariation.discount_price : null
                                })}
                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                              />
                              <span className="text-sm font-semibold text-gray-700">🏷️ Enable Discount</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                          <button
                            onClick={handleUpdateVariation}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                          >
                            <Save className="w-5 h-5" />
                            Save Changes
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={isProcessing}
                            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border-2 border-teal-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Size Name</div>
                            <div className="font-bold text-gray-900">{variation.name}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Quantity</div>
                            <div className="font-semibold text-gray-700">{variation.quantity_mg}mg</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Selling Price</div>
                            <div className="font-semibold text-teal-600">₱{variation.price.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Cost / Profit</div>
                            <div className="font-semibold text-gray-700">
                              ₱{(variation.cost_price ?? 0).toLocaleString()}
                              {variation.cost_price > 0 && variation.price > 0 && (
                                <span className="text-xs text-emerald-600 ml-1">
                                  ({(((variation.price - variation.cost_price) / variation.price) * 100).toFixed(0)}%)
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Stock</div>
                            <div className="font-semibold text-gray-700">{variation.stock_quantity} units</div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditVariation(variation)}
                            disabled={isProcessing}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Edit variation"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteVariation(variation.id, variation.name)}
                            disabled={isProcessing}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete variation"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Variation */}
          <div className="border-t-2 border-gray-200 pt-6">
            <button
              onClick={() => {
                setIsAdding(!isAdding);
                setEditingId(null); // Close edit mode when adding new
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg mb-4"
            >
              <Plus className="w-5 h-5" />
              {isAdding ? 'Cancel' : 'Add New Size'}
            </button>

            {isAdding && (
              <div className="bg-white border-2 border-teal-300 rounded-xl p-6 space-y-4">
                <h4 className="font-bold text-gray-900 mb-4">New Size Variation</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Size Name *
                    </label>
                    <input
                      type="text"
                      value={newVariation.name}
                      onChange={(e) => setNewVariation({ ...newVariation, name: e.target.value })}
                      placeholder="e.g., 5mg, 10mg, 20mg"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Quantity (mg) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newVariation.quantity_mg}
                      onChange={(e) => setNewVariation({ ...newVariation, quantity_mg: parseFloat(e.target.value) || 0 })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Selling Price (₱) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newVariation.price}
                      onChange={(e) => setNewVariation({ ...newVariation, price: parseFloat(e.target.value) || 0 })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Raw Cost (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newVariation.cost_price}
                      onChange={(e) => setNewVariation({ ...newVariation, cost_price: parseFloat(e.target.value) || 0 })}
                      className="input-field"
                      placeholder="Wholesale / supplier cost"
                    />
                    {newVariation.price > 0 && newVariation.cost_price > 0 && (
                      <p className="text-xs text-emerald-600 mt-1 font-medium">
                        Profit: ₱{(newVariation.price - newVariation.cost_price).toLocaleString()} ({(((newVariation.price - newVariation.cost_price) / newVariation.price) * 100).toFixed(1)}%)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      value={newVariation.stock_quantity}
                      onChange={(e) => setNewVariation({ ...newVariation, stock_quantity: parseInt(e.target.value) || 0 })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Discount Price (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newVariation.discount_price || ''}
                      onChange={(e) => setNewVariation({ ...newVariation, discount_price: parseFloat(e.target.value) || null })}
                      className="input-field"
                      placeholder="Leave empty for no discount"
                    />
                  </div>

                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newVariation.discount_active}
                        onChange={(e) => setNewVariation({
                          ...newVariation,
                          discount_active: e.target.checked,
                          discount_price: e.target.checked ? newVariation.discount_price : null
                        })}
                        className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm font-semibold text-gray-700">🏷️ Enable Discount</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleAddVariation}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    Save Variation
                  </button>
                  <button
                    onClick={() => setIsAdding(false)}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VariationManager;

