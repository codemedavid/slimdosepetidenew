import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Package, CheckCircle, XCircle, Clock, Truck, AlertCircle, Search, RefreshCw, Eye, MessageCircle, Image as ImageIcon, Pencil, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useMenu } from '../hooks/useMenu';
import {
  mirrorOrderUpdateDetails,
  mirrorOrderUpdateStatus,
  mirrorOrderUpdateTracking,
  mirrorProductAdjustStock,
  mirrorVariationAdjustStock,
} from '../lib/convexMirror';
import { trackOrderStatus, trackPaymentStatus, type OrderStatus } from '../utils/analytics';

function buildOrderEmailProps(order: any) {
  const fmt = (n: unknown) => Number(n ?? 0).toLocaleString('en-PH');
  const items: any[] = Array.isArray(order?.order_items) ? order.order_items : [];
  const itemsSummary = items
    .map((i: any) => {
      const name = i.variation_name ? `${i.product_name} — ${i.variation_name}` : i.product_name;
      return `${i.quantity} × ${name} — ₱${Number(i.total ?? 0).toLocaleString('en-PH')}`;
    })
    .join('\n');
  const subtotalNum = Number(order?.total_price ?? 0) + Number(order?.discount_applied ?? 0);
  const finalTotalNum = Number(order?.total_price ?? 0) + Number(order?.shipping_fee ?? 0);
  const contact = String(order?.contact_method || '');
  return {
    order_id: order?.id,
    order_number: order?.order_number ?? null,
    items_summary: itemsSummary,
    subtotal: fmt(subtotalNum),
    shipping_fee: fmt(order?.shipping_fee),
    discount: fmt(order?.discount_applied),
    promo_code: order?.promo_code || '',
    total_price: fmt(finalTotalNum),
    payment_method: order?.payment_method_name || '—',
    contact_method: contact ? contact.charAt(0).toUpperCase() + contact.slice(1) : '—',
    email: order?.customer_email ?? null,
    customer_name: order?.customer_name ?? null,
  };
}

async function moveOrderTelegramTopic(orderId: string, newStatus: string) {
  try {
    const { error } = await supabase.functions.invoke('telegram-move-order', {
      body: { order_id: orderId, new_status: newStatus, actor_name: 'Web Admin' },
    });
    if (error) console.warn('telegram-move-order failed', error);
  } catch (err) {
    console.warn('telegram-move-order threw', err);
  }
}

interface OrderItem {
  product_id: string;
  product_name: string;
  variation_id: string | null;
  variation_name: string | null;
  quantity: number;
  price: number;
  total: number;
  purity_percentage?: number;
}

interface Order {
  id: string;
  order_number: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  shipping_barangay: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_zip_code: string;
  shipping_country: string;
  shipping_location: string | null;
  shipping_fee: number | null;
  order_items: OrderItem[];
  total_price: number;
  payment_method_id: string | null;
  payment_method_name: string | null;
  payment_proof_url: string | null;
  contact_method: string | null;
  order_status: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tracking_number: string | null;
  shipping_note: string | null;
  promo_code: string | null;
  promo_code_id: string | null;
  discount_applied: number | null;
}

interface OrdersManagerProps {
  onBack: () => void;
}

const OrdersManager: React.FC<OrdersManagerProps> = ({ onBack }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { refreshProducts } = useMenu();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      alert('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadOrders();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleConfirmOrder = async (order: Order) => {
    if (!confirm(`Confirm order #${order.order_number || order.id.slice(0, 8)}? This will deduct stock from inventory.`)) {
      return;
    }

    try {
      setIsProcessing(true);

      // First, check if all items are still in stock
      for (const item of order.order_items) {
        if (item.variation_id) {
          // Check variation stock
          const { data: variation, error: varError } = await supabase
            .from('product_variations')
            .select('stock_quantity')
            .eq('id', item.variation_id)
            .single();

          if (varError) throw varError;
          if (!variation || variation.stock_quantity < item.quantity) {
            alert(`Insufficient stock for ${item.product_name} ${item.variation_name || ''}. Available: ${variation?.stock_quantity || 0}, Required: ${item.quantity}`);
            return;
          }
        } else {
          // Check product stock
          const { data: product, error: prodError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single();

          if (prodError) throw prodError;
          if (!product || product.stock_quantity < item.quantity) {
            alert(`Insufficient stock for ${item.product_name}. Available: ${product?.stock_quantity || 0}, Required: ${item.quantity}`);
            return;
          }
        }
      }

      // Deduct stock for each item
      for (const item of order.order_items) {
        if (item.variation_id) {
          // Deduct from variation - get current stock and update
          const { data: variation, error: varError } = await supabase
            .from('product_variations')
            .select('stock_quantity')
            .eq('id', item.variation_id)
            .single();

          if (varError) throw varError;

          if (variation) {
            const newStock = Math.max(0, variation.stock_quantity - item.quantity);
            const { error: updateError } = await supabase
              .from('product_variations')
              .update({ stock_quantity: newStock })
              .eq('id', item.variation_id);

            if (updateError) throw updateError;
            mirrorVariationAdjustStock(item.variation_id, newStock);
          }
        } else {
          // Deduct from product - get current stock and update
          const { data: product, error: prodError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single();

          if (prodError) throw prodError;

          if (product) {
            const newStock = Math.max(0, product.stock_quantity - item.quantity);
            const { error: updateError } = await supabase
              .from('products')
              .update({ stock_quantity: newStock })
              .eq('id', item.product_id);

            if (updateError) throw updateError;
            mirrorProductAdjustStock(item.product_id, newStock);
          }
        }
      }

      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_status: 'confirmed',
          payment_status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) throw updateError;
      mirrorOrderUpdateStatus(order.id, { order_status: 'confirmed', payment_status: 'paid' });
      moveOrderTelegramTopic(order.id, 'confirmed');
      const emailProps = buildOrderEmailProps(order);
      trackOrderStatus('confirmed', emailProps);
      trackPaymentStatus('paid', { ...emailProps, payment_status: 'paid' });

      // Refresh orders and products
      await loadOrders();
      await refreshProducts();

      // Trigger custom event to refresh inventory sales data
      window.dispatchEvent(new CustomEvent('orderConfirmed'));

      alert(`Order confirmed! Stock has been deducted from inventory.`);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error confirming order:', error);
      alert(`Failed to confirm order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setIsProcessing(true);
      const { error } = await supabase
        .from('orders')
        .update({
          order_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      mirrorOrderUpdateStatus(orderId, { order_status: newStatus });
      moveOrderTelegramTopic(orderId, newStatus);
      const targetOrder = orders.find(o => o.id === orderId);
      trackOrderStatus(newStatus as OrderStatus, buildOrderEmailProps(targetOrder));
      await loadOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, order_status: newStatus });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveTracking = async (orderId: string, trackingNumber: string, shippingNote: string) => {
    try {
      setIsProcessing(true);
      const { error } = await supabase
        .from('orders')
        .update({
          tracking_number: trackingNumber || null,
          shipping_note: shippingNote || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      mirrorOrderUpdateTracking(orderId, {
        tracking_number: trackingNumber || undefined,
        shipping_note: shippingNote || undefined,
      });

      // Update local state
      const updatedOrders = orders.map(o =>
        o.id === orderId
          ? { ...o, tracking_number: trackingNumber || null, shipping_note: shippingNote || null }
          : o
      );
      setOrders(updatedOrders);

      if (selectedOrder?.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          tracking_number: trackingNumber || null,
          shipping_note: shippingNote || null
        });
      }

      alert('Tracking information saved successfully!');
    } catch (error) {
      console.error('Error saving tracking info:', error);
      alert('Failed to save tracking information.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
      setIsProcessing(true);
      const { error } = await supabase
        .from('orders')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      mirrorOrderUpdateDetails(orderId, updates);
      await loadOrders();

      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, ...updates } as Order);
      }

      alert('Order updated successfully!');
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Failed to save order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.order_status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.customer_name.toLowerCase().includes(query) ||
        o.customer_email.toLowerCase().includes(query) ||
        o.customer_phone.includes(query) ||
        o.id.toLowerCase().includes(query) ||
        (o.order_number?.toLowerCase().includes(query) ?? false)
      );
    }

    return filtered;
  }, [orders, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      all: orders.length,
      new: orders.filter(o => o.order_status === 'new').length,
      confirmed: orders.filter(o => o.order_status === 'confirmed').length,
      processing: orders.filter(o => o.order_status === 'processing').length,
      shipped: orders.filter(o => o.order_status === 'shipped').length,
      delivered: orders.filter(o => o.order_status === 'delivered').length,
      cancelled: orders.filter(o => o.order_status === 'cancelled').length,
    };
  }, [orders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-gold-100 text-gold-800 border-navy-700';
      case 'confirmed': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'processing': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'shipped': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <Package className="w-4 h-4" />;
      case 'shipped': return <Truck className="w-4 h-4" />;
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-gold-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading orders... ✨</p>
        </div>
      </div>
    );
  }

  if (selectedOrder) {
    return (
      <OrderDetailsView
        order={selectedOrder}
        onBack={() => setSelectedOrder(null)}
        onConfirm={() => handleConfirmOrder(selectedOrder)}
        onUpdateStatus={handleUpdateOrderStatus}
        onSaveTracking={handleSaveTracking}
        onSaveOrder={handleSaveOrder}
        isProcessing={isProcessing}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-md border-b-4 border-navy-900">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-12 md:h-14 gap-2">
            <div className="flex items-center space-x-2 md:space-x-4 min-w-0 flex-1">
              <button
                onClick={onBack}
                className="text-gray-700 hover:text-gold-600 transition-colors flex items-center gap-1 md:gap-2 group"
              >
                <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs md:text-sm">Dashboard</span>
              </button>
              <h1 className="text-sm md:text-base lg:text-xl font-bold text-navy-900 truncate">
                Orders Management
              </h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-navy-900 hover:bg-navy-800 text-white px-2 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl font-medium text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-1 md:gap-2 disabled:opacity-50 border border-navy-900/20"
            >
              <RefreshCw className={`w-3 h-3 md:w-4 md:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 md:py-4 lg:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3 mb-4 md:mb-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={`bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg p-2 md:p-3 lg:p-4 border-2 transition-all ${statusFilter === 'all' ? 'border-navy-900 shadow-gold-glow' : 'border-gray-200 hover:border-navy-700'
              }`}
          >
            <p className="text-[10px] md:text-xs text-gray-600 mb-1">All Orders</p>
            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">{statusCounts.all}</p>
          </button>
          <button
            onClick={() => setStatusFilter('new')}
            className={`bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg p-2 md:p-3 lg:p-4 border-2 transition-all ${statusFilter === 'new' ? 'border-navy-900 shadow-gold-glow' : 'border-gray-200 hover:border-navy-700'
              }`}
          >
            <p className="text-[10px] md:text-xs text-gray-600 mb-1">New</p>
            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gold-600">{statusCounts.new}</p>
          </button>
          <button
            onClick={() => setStatusFilter('confirmed')}
            className={`bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg p-2 md:p-3 lg:p-4 border-2 transition-all ${statusFilter === 'confirmed' ? 'border-navy-900 shadow-gold-glow' : 'border-gray-200 hover:border-navy-700'
              }`}
          >
            <p className="text-[10px] md:text-xs text-gray-600 mb-1">Confirmed</p>
            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">{statusCounts.confirmed}</p>
          </button>
          <button
            onClick={() => setStatusFilter('processing')}
            className={`bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg p-2 md:p-3 lg:p-4 border-2 transition-all ${statusFilter === 'processing' ? 'border-navy-900 shadow-gold-glow' : 'border-gray-200 hover:border-navy-700'
              }`}
          >
            <p className="text-[10px] md:text-xs text-gray-600 mb-1">Processing</p>
            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-800">{statusCounts.processing}</p>
          </button>
          <button
            onClick={() => setStatusFilter('shipped')}
            className={`bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg p-2 md:p-3 lg:p-4 border-2 transition-all ${statusFilter === 'shipped' ? 'border-navy-900 shadow-gold-glow' : 'border-gray-200 hover:border-navy-700'
              }`}
          >
            <p className="text-[10px] md:text-xs text-gray-600 mb-1">Shipped</p>
            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">{statusCounts.shipped}</p>
          </button>
          <button
            onClick={() => setStatusFilter('delivered')}
            className={`bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg p-2 md:p-3 lg:p-4 border-2 transition-all ${statusFilter === 'delivered' ? 'border-navy-900 shadow-gold-glow' : 'border-gray-200 hover:border-navy-700'
              }`}
          >
            <p className="text-[10px] md:text-xs text-gray-600 mb-1">Delivered</p>
            <p className="text-lg md:text-xl lg:text-2xl font-bold text-green-600">{statusCounts.delivered}</p>
          </button>
          <button
            onClick={() => setStatusFilter('cancelled')}
            className={`bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg p-2 md:p-3 lg:p-4 border-2 transition-all ${statusFilter === 'cancelled' ? 'border-red-500' : 'border-gray-200 hover:border-red-300'
              }`}
          >
            <p className="text-[10px] md:text-xs text-gray-600 mb-1">Cancelled</p>
            <p className="text-lg md:text-xl lg:text-2xl font-bold text-red-600">{statusCounts.cancelled}</p>
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-3 md:p-4 lg:p-6 mb-4 md:mb-6 border border-navy-700/30">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <input
                type="text"
                placeholder="Search by customer name, email, phone, or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2 text-sm md:text-base border-2 border-gray-200 rounded-lg focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-gold-500/20 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-3 md:space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-8 md:p-12 text-center border border-navy-700/30">
              <Package className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium text-base md:text-lg">No orders found</p>
              <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onView={() => setSelectedOrder(order)}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Order Card Component
interface OrderCardProps {
  order: Order;
  onView: () => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onView, getStatusColor, getStatusIcon }) => {
  const totalItems = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const finalTotal = order.total_price + (order.shipping_fee || 0);

  return (
    <div className="bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg p-3 md:p-4 lg:p-6 border border-navy-700/30 hover:border-navy-900 transition-all">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-sm md:text-base lg:text-lg truncate">
              Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}
            </h3>
            <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold border flex items-center gap-1 ${getStatusColor(order.order_status)}`}>
              {getStatusIcon(order.order_status)}
              <span className="hidden sm:inline">{order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}</span>
              <span className="sm:hidden">{order.order_status.charAt(0).toUpperCase()}</span>
            </span>
            <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gold-100 text-gold-700'
              }`}>
              {order.payment_status === 'paid' ? '✓ Paid' : 'Pending'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
            <div className="min-w-0">
              <span className="text-gray-500 text-[10px] md:text-xs">Customer</span>
              <p className="font-semibold text-gray-900 truncate">{order.customer_name}</p>
              <p className="text-[10px] md:text-xs text-gray-500 truncate">{order.customer_email}</p>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] md:text-xs">Items</span>
              <p className="font-semibold text-gray-900">{totalItems} item(s)</p>
              <p className="text-[10px] md:text-xs text-gray-500">{order.order_items.length} product(s)</p>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] md:text-xs">Total</span>
              <p className="font-semibold text-gold-600">₱{finalTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
              {order.shipping_fee && order.shipping_fee > 0 && (
                <p className="text-[10px] md:text-xs text-gray-500">+ ₱{order.shipping_fee} shipping</p>
              )}
              {order.discount_applied && order.discount_applied > 0 && (
                <p className="text-[10px] md:text-xs text-green-600">
                  -₱{order.discount_applied.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  {order.promo_code ? ` (${order.promo_code})` : ' discount'}
                </p>
              )}
            </div>
            <div>
              <span className="text-gray-500 text-[10px] md:text-xs">Date</span>
              <p className="font-semibold text-gray-900">{new Date(order.created_at).toLocaleDateString()}</p>
              <p className="text-[10px] md:text-xs text-gray-500">{new Date(order.created_at).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:min-w-[120px]">
          <button
            onClick={onView}
            className="px-3 md:px-4 py-1.5 md:py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg transition-colors font-medium text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 shadow-md hover:shadow-lg border border-navy-900/20"
          >
            <Eye className="w-3 h-3 md:w-4 md:h-4" />
            <span className="hidden sm:inline">View Details</span>
            <span className="sm:hidden">View</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Order Details View Component
interface OrderDetailsViewProps {
  order: Order;
  onBack: () => void;
  onConfirm: () => void;
  onUpdateStatus: (orderId: string, status: string) => void;
  onSaveTracking: (orderId: string, trackingNumber: string, shippingNote: string) => void;
  onSaveOrder: (orderId: string, updates: Partial<Order>) => void;
  isProcessing: boolean;
}

const ORDER_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const OrderDetailsView: React.FC<OrderDetailsViewProps> = ({
  order,
  onBack,
  onConfirm,
  onUpdateStatus,
  onSaveTracking,
  onSaveOrder,
  isProcessing
}) => {
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '');
  const [shippingNote, setShippingNote] = useState(order.shipping_note || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    shipping_address: order.shipping_address,
    shipping_barangay: order.shipping_barangay || '',
    shipping_city: order.shipping_city,
    shipping_state: order.shipping_state,
    shipping_zip_code: order.shipping_zip_code,
    shipping_country: order.shipping_country || '',
    notes: order.notes || '',
  });

  // Update local state when order changes
  useEffect(() => {
    setTrackingNumber(order.tracking_number || '');
    setShippingNote(order.shipping_note || '');
    setEditForm({
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      shipping_address: order.shipping_address,
      shipping_barangay: order.shipping_barangay || '',
      shipping_city: order.shipping_city,
      shipping_state: order.shipping_state,
      shipping_zip_code: order.shipping_zip_code,
      shipping_country: order.shipping_country || '',
      notes: order.notes || '',
    });
    setIsEditing(false);
  }, [order]);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === order.order_status) return;

    if (newStatus === 'confirmed' && order.order_status === 'new') {
      onConfirm();
      return;
    }

    if (newStatus === 'cancelled') {
      if (confirm('Are you sure you want to cancel this order?')) {
        onUpdateStatus(order.id, newStatus);
      }
      return;
    }

    onUpdateStatus(order.id, newStatus);
  };

  const handleSaveEdit = () => {
    const updates: Partial<Order> = {
      customer_name: editForm.customer_name,
      customer_email: editForm.customer_email,
      customer_phone: editForm.customer_phone,
      shipping_address: editForm.shipping_address,
      shipping_barangay: editForm.shipping_barangay || null,
      shipping_city: editForm.shipping_city,
      shipping_state: editForm.shipping_state,
      shipping_zip_code: editForm.shipping_zip_code,
      shipping_country: editForm.shipping_country,
      notes: editForm.notes || null,
    };
    onSaveOrder(order.id, updates);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditForm({
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      shipping_address: order.shipping_address,
      shipping_barangay: order.shipping_barangay || '',
      shipping_city: order.shipping_city,
      shipping_state: order.shipping_state,
      shipping_zip_code: order.shipping_zip_code,
      shipping_country: order.shipping_country || '',
      notes: order.notes || '',
    });
    setIsEditing(false);
  };
  const totalItems = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const finalTotal = order.total_price + (order.shipping_fee || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white">
      <div className="bg-white shadow-md border-b border-navy-700/30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-12 md:h-14 gap-2">
            <div className="flex items-center space-x-2 md:space-x-4 min-w-0 flex-1">
              <button
                onClick={onBack}
                className="text-gray-700 hover:text-gold-600 transition-colors flex items-center gap-1 md:gap-2 group"
              >
                <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs md:text-sm">Back to Orders</span>
              </button>
              <h1 className="text-sm md:text-base lg:text-xl font-bold text-navy-900 truncate">
                Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="px-2 md:px-3 py-1.5 md:py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium text-xs md:text-sm flex items-center gap-1"
                  >
                    <X className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isProcessing}
                    className="px-2 md:px-3 py-1.5 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-xs md:text-sm flex items-center gap-1 disabled:opacity-50 shadow-md"
                  >
                    <Save className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">{isProcessing ? 'Saving...' : 'Save'}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-2 md:px-3 py-1.5 md:py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg transition-colors font-medium text-xs md:text-sm flex items-center gap-1 shadow-md"
                >
                  <Pencil className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Edit Order</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-4 md:py-6 lg:py-8">
        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6 border border-navy-700/30 space-y-4 md:space-y-6">
          {/* Order Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Order Status</label>
                <select
                  value={order.order_status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isProcessing}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold border-2 outline-none cursor-pointer transition-colors disabled:opacity-50 ${
                    order.order_status === 'new' ? 'bg-gold-100 text-gold-800 border-gold-300' :
                    order.order_status === 'confirmed' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                    order.order_status === 'processing' ? 'bg-purple-50 text-purple-800 border-purple-300' :
                    order.order_status === 'shipped' ? 'bg-indigo-50 text-indigo-800 border-indigo-300' :
                    order.order_status === 'delivered' ? 'bg-green-50 text-green-800 border-green-300' :
                    'bg-red-50 text-red-800 border-red-300'
                  }`}
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {order.order_status === 'new' && (
              <button
                onClick={onConfirm}
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 md:px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-colors font-medium text-xs md:text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
              >
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">{isProcessing ? 'Processing...' : 'Confirm Order & Deduct Stock'}</span>
                <span className="sm:hidden">{isProcessing ? 'Processing...' : 'Confirm Order'}</span>
              </button>
            )}
          </div>

          {/* Customer Info */}
          <div>
            <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm md:text-base">Customer Information</h3>
            {isEditing ? (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-3 text-xs md:text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.customer_email}
                    onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.customer_phone}
                    onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
                  />
                </div>
                {order.contact_method && (
                  <p className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">Contact Method:</span>
                    <span className="flex items-center gap-1 text-blue-500"><MessageCircle className="w-3 h-3 md:w-4 md:h-4" /> Telegram</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-1.5 md:space-y-2 text-xs md:text-sm">
                <p><span className="font-semibold">Name:</span> {order.customer_name}</p>
                <p><span className="font-semibold">Email:</span> {order.customer_email}</p>
                <p><span className="font-semibold">Phone:</span> {order.customer_phone}</p>
                {order.contact_method && (
                  <p className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">Contact Method:</span>
                    <span className="flex items-center gap-1 text-blue-500"><MessageCircle className="w-3 h-3 md:w-4 md:h-4" /> Telegram</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Shipping Address */}
          <div>
            <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm md:text-base">Shipping Address</h3>
            {isEditing ? (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-3 text-xs md:text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={editForm.shipping_address}
                    onChange={(e) => setEditForm({ ...editForm, shipping_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Barangay</label>
                  <input
                    type="text"
                    value={editForm.shipping_barangay}
                    onChange={(e) => setEditForm({ ...editForm, shipping_barangay: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                    <input
                      type="text"
                      value={editForm.shipping_city}
                      onChange={(e) => setEditForm({ ...editForm, shipping_city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Province/State</label>
                    <input
                      type="text"
                      value={editForm.shipping_state}
                      onChange={(e) => setEditForm({ ...editForm, shipping_state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Zip Code</label>
                    <input
                      type="text"
                      value={editForm.shipping_zip_code}
                      onChange={(e) => setEditForm({ ...editForm, shipping_zip_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
                    <input
                      type="text"
                      value={editForm.shipping_country}
                      onChange={(e) => setEditForm({ ...editForm, shipping_country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
                    />
                  </div>
                </div>
                {order.shipping_location && (
                  <p><span className="font-semibold">Region:</span> {order.shipping_location}</p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 text-xs md:text-sm">
                <p>{order.shipping_address}</p>
                {order.shipping_barangay && (
                  <p>Barangay: {order.shipping_barangay}</p>
                )}
                <p>{order.shipping_city}, {order.shipping_state} {order.shipping_zip_code}</p>
                <p>{order.shipping_country}</p>
                {order.shipping_location && (
                  <p className="mt-2"><span className="font-semibold">Region:</span> {order.shipping_location}</p>
                )}
              </div>
            )}
          </div>

          {/* Shipping & Tracking Details (Editable) */}
          <div className="bg-blue-50 rounded-lg md:rounded-xl p-4 md:p-6 border border-blue-100">
            <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              Shipping & Tracking Details
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  J&T Tracking Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g., 78XXXX..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  {trackingNumber && (
                    <a
                      href={`https://www.jtexpress.ph/trajectoryQuery?bills=${trackingNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center justify-center"
                      title="Test Link"
                    >
                      <Truck className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shipping Note (Optional)
                </label>
                <input
                  type="text"
                  value={shippingNote}
                  onChange={(e) => setShippingNote(e.target.value)}
                  placeholder="e.g., Shipped via J&T Express..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                onClick={() => onSaveTracking(order.id, trackingNumber, shippingNote)}
                disabled={isProcessing}
                className="self-end px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
              >
                {isProcessing ? 'Saving...' : 'Save Tracking Info'}
              </button>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm md:text-base">Order Items ({totalItems} items)</h3>
            <div className="space-y-2">
              {order.order_items.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 md:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-xs md:text-sm">
                      {item.product_name} {item.variation_name ? `- ${item.variation_name}` : ''}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-500">
                      Quantity: {item.quantity} × ₱{item.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="font-bold text-gray-900 text-xs md:text-sm sm:text-base">
                    ₱{item.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Proof */}
          {order.payment_proof_url && (
            <div>
              <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm md:text-base flex items-center gap-2">
                <ImageIcon className="w-4 h-4 md:w-5 md:h-5" />
                Payment Proof
              </h3>
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <img
                  src={order.payment_proof_url}
                  alt="Payment proof"
                  className="max-w-full h-auto rounded-lg border border-gray-300"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `
                      <div class="text-red-600 p-3 md:p-4 text-center text-xs md:text-sm">
                        <p>⚠️ Payment proof image failed to load</p>
                        <p class="text-[10px] md:text-xs text-gray-500 mt-2">URL: ${order.payment_proof_url}</p>
                      </div>
                    `;
                  }}
                />
              </div>
            </div>
          )}

          {/* Payment Info */}
          <div>
            <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm md:text-base">Payment Information</h3>
            <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-1.5 md:space-y-2 text-xs md:text-sm">
              <p><span className="font-semibold">Method:</span> {order.payment_method_name || 'N/A'}</p>
              <p className="flex items-center gap-2 flex-wrap"><span className="font-semibold">Status:</span>
                <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-semibold ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gold-100 text-gold-700'
                  }`}>
                  {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                </span>
              </p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="border-t-2 border-gray-200 pt-3 md:pt-4">
            <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
              {order.discount_applied && order.discount_applied > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold">₱{(order.total_price + order.discount_applied).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>
                      Discount{order.promo_code ? ` (${order.promo_code})` : ''}:
                    </span>
                    <span className="font-semibold">-₱{order.discount_applied.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal after discount:</span>
                    <span className="font-semibold">₱{order.total_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">₱{order.total_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {order.shipping_fee && order.shipping_fee > 0 && (
                <div className="flex justify-between">
                  <span>Shipping Fee:</span>
                  <span className="font-semibold">₱{order.shipping_fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-base md:text-lg font-bold border-t-2 border-gray-200 pt-2">
                <span>Total:</span>
                <span className="text-gold-600">₱{finalTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {(order.notes || isEditing) && (
            <div>
              <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm md:text-base">Notes</h3>
              {isEditing ? (
                <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Add notes..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none text-xs md:text-sm"
                  />
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                  <p className="text-gray-700 text-xs md:text-sm">{order.notes}</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default OrdersManager;
