import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    ChevronLeft,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingBag,
    Package,
    Activity,
    Trophy,
    Medal,
    Flame,
    Clock,
    Box,
    Download,
    PiggyBank,
    Coins,
    Percent,
} from 'lucide-react';

interface SalesAnalyticsManagerProps {
    onBack?: () => void;
}

interface AnalyticsRow {
    total_orders: number;
    total_units: number;
    gross_sales: number;
    total_cost: number;
    net_profit: number;
    total_revenue: number;
    average_order_value: number;
}

interface ProductRanking {
    product_name: string;
    units_sold: number;
    revenue: number;
    cost: number;
    profit: number;
}

interface RecentSale {
    id: string;
    order_number: string | null;
    customer_name: string;
    total_price: number;
    created_at: string;
    order_items: any[];
}

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all' | 'custom';

const EMPTY_METRICS: AnalyticsRow = {
    total_orders: 0,
    total_units: 0,
    gross_sales: 0,
    total_cost: 0,
    net_profit: 0,
    total_revenue: 0,
    average_order_value: 0,
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount || 0);
};

const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const computeRange = (timeframe: Timeframe, customStart: string, customEnd: string) => {
    const now = new Date();
    let startDate = new Date();
    let previousStartDate = new Date();
    let previousEndDate = new Date();

    if (timeframe === 'all') {
        startDate = new Date('2020-01-01');
        previousStartDate = new Date('2019-01-01');
        previousEndDate = new Date('2019-12-31T23:59:59.999Z');
    } else if (timeframe === 'daily') {
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        previousEndDate.setHours(23, 59, 59, 999);
    } else if (timeframe === 'weekly') {
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        previousEndDate = new Date(startDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        previousEndDate.setHours(23, 59, 59, 999);
    } else if (timeframe === 'monthly') {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate = new Date(startDate);
        previousStartDate.setMonth(previousStartDate.getMonth() - 1);
        previousEndDate = new Date(startDate);
        previousEndDate.setDate(0);
        previousEndDate.setHours(23, 59, 59, 999);
    } else if (timeframe === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
        previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
        previousEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    } else {
        // custom
        startDate = customStart ? new Date(customStart + 'T00:00:00') : new Date('2020-01-01');
        const endDate = customEnd ? new Date(customEnd + 'T23:59:59.999') : now;
        const span = endDate.getTime() - startDate.getTime();
        previousEndDate = new Date(startDate.getTime() - 1);
        previousStartDate = new Date(previousEndDate.getTime() - span);
        return { startDate, endDate, previousStartDate, previousEndDate };
    }

    return { startDate, endDate: now, previousStartDate, previousEndDate };
};

const toNum = (v: any) => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const normalizeMetrics = (raw: any): AnalyticsRow => {
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row) return { ...EMPTY_METRICS };
    return {
        total_orders: toNum(row.total_orders),
        total_units: toNum(row.total_units),
        gross_sales: toNum(row.gross_sales),
        total_cost: toNum(row.total_cost),
        net_profit: toNum(row.net_profit),
        total_revenue: toNum(row.total_revenue),
        average_order_value: toNum(row.average_order_value),
    };
};

const csvEscape = (val: any) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
};

const downloadCSV = (filename: string, rows: (string | number)[][]) => {
    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const SalesAnalyticsManager: React.FC<SalesAnalyticsManagerProps> = ({ onBack }) => {
    const [timeframe, setTimeframe] = useState<Timeframe>('all');
    const [customStart, setCustomStart] = useState<string>(toISODate(new Date(Date.now() - 30 * 86400000)));
    const [customEnd, setCustomEnd] = useState<string>(toISODate(new Date()));
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [metrics, setMetrics] = useState<{ current: AnalyticsRow; previous: AnalyticsRow }>({
        current: { ...EMPTY_METRICS },
        previous: { ...EMPTY_METRICS },
    });
    const [rankings, setRankings] = useState<ProductRanking[]>([]);
    const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
    const [sortBy, setSortBy] = useState<'units' | 'revenue' | 'profit'>('units');

    const range = useMemo(() => computeRange(timeframe, customStart, customEnd), [timeframe, customStart, customEnd]);

    const fetchData = async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const { startDate, endDate, previousStartDate, previousEndDate } = range;

            const [currentRes, prevRes, rankingsRes, salesRes] = await Promise.all([
                supabase.rpc('get_sales_analytics', { date_start: startDate.toISOString(), date_end: endDate.toISOString() }),
                supabase.rpc('get_sales_analytics', { date_start: previousStartDate.toISOString(), date_end: previousEndDate.toISOString() }),
                supabase.rpc('get_product_rankings_v2', { date_start: startDate.toISOString(), date_end: endDate.toISOString(), limit_count: 10 }),
                supabase.from('orders').select('id, order_number, customer_name, total_price, created_at, order_items').order('created_at', { ascending: false }).limit(5),
            ]);

            setMetrics({
                current: normalizeMetrics(currentRes.data),
                previous: normalizeMetrics(prevRes.data),
            });
            setRankings((rankingsRes.data || []).map((r: any) => ({
                product_name: r.product_name,
                units_sold: toNum(r.units_sold),
                revenue: toNum(r.revenue),
                cost: toNum(r.cost),
                profit: toNum(r.profit),
            })));
            setRecentSales(salesRes.data || []);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        const channel = supabase
            .channel('analytics-updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => setTimeout(() => fetchData(true), 1000))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeframe, customStart, customEnd]);

    const calculateTrend = (current: number, previous: number) => {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };

    const margin = metrics.current.gross_sales > 0
        ? (metrics.current.net_profit / metrics.current.gross_sales) * 100
        : 0;
    const prevMargin = metrics.previous.gross_sales > 0
        ? (metrics.previous.net_profit / metrics.previous.gross_sales) * 100
        : 0;

    const sortedRankings = useMemo(() => {
        return [...rankings].sort((a, b) => {
            if (sortBy === 'units') return b.units_sold - a.units_sold;
            if (sortBy === 'revenue') return b.revenue - a.revenue;
            return b.profit - a.profit;
        });
    }, [rankings, sortBy]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const { startDate, endDate } = range;
            const { data, error } = await supabase
                .from('orders')
                .select('id, order_number, customer_name, customer_email, customer_phone, total_price, subtotal, shipping_fee, discount_applied, payment_method_name, payment_status, order_status, order_items, created_at')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            const variationIds = new Set<string>();
            const productIds = new Set<string>();
            (data || []).forEach((o: any) => (o.order_items || []).forEach((i: any) => {
                if (i.variation_id) variationIds.add(i.variation_id);
                if (i.product_id) productIds.add(i.product_id);
            }));

            const costMap = new Map<string, number>();
            const variationToProduct = new Map<string, string>();
            if (variationIds.size > 0) {
                const { data: variations } = await supabase
                    .from('product_variations')
                    .select('id, product_id, cost_price')
                    .in('id', Array.from(variationIds));
                (variations || []).forEach((v: any) => {
                    costMap.set(v.id, toNum(v.cost_price));
                    if (v.product_id) variationToProduct.set(v.id, v.product_id);
                });
            }

            const rawPriceMap = new Map<string, number>();
            if (productIds.size > 0) {
                const { data: prods } = await supabase
                    .from('products')
                    .select('id, raw_price')
                    .in('id', Array.from(productIds));
                (prods || []).forEach((p: any) => rawPriceMap.set(p.id, toNum(p.raw_price)));
            }

            const unitCostFor = (item: any) => {
                const vCost = item.variation_id ? costMap.get(item.variation_id) ?? 0 : 0;
                if (vCost > 0) return vCost;
                const pid = item.product_id || (item.variation_id ? variationToProduct.get(item.variation_id) : undefined);
                return pid ? rawPriceMap.get(pid) ?? 0 : 0;
            };

            const rows: (string | number)[][] = [
                ['Order #', 'Date', 'Customer', 'Email', 'Phone', 'Status', 'Payment', 'Items', 'Units', 'Gross Sales', 'Raw Cost', 'Profit', 'Margin %', 'Discount', 'Shipping', 'Total Paid'],
            ];

            (data || []).forEach((o: any) => {
                const items: any[] = o.order_items || [];
                const itemSummary = items.map(i => `${i.product_name}${i.variation_name ? ` (${i.variation_name})` : ''} x${i.quantity}`).join('; ');
                const units = items.reduce((s, i) => s + toNum(i.quantity), 0);
                const gross = items.reduce((s, i) => s + toNum(i.total), 0);
                const cost = items.reduce((s, i) => s + toNum(i.quantity) * unitCostFor(i), 0);
                const profit = gross - cost;
                const marginPct = gross > 0 ? (profit / gross) * 100 : 0;

                rows.push([
                    o.order_number || o.id,
                    new Date(o.created_at).toISOString(),
                    o.customer_name || '',
                    o.customer_email || '',
                    o.customer_phone || '',
                    o.order_status || '',
                    `${o.payment_method_name || ''} (${o.payment_status || ''})`,
                    itemSummary,
                    units,
                    gross.toFixed(2),
                    cost.toFixed(2),
                    profit.toFixed(2),
                    marginPct.toFixed(2),
                    toNum(o.discount_applied).toFixed(2),
                    toNum(o.shipping_fee).toFixed(2),
                    toNum(o.total_price).toFixed(2),
                ]);
            });

            const filename = `sales_report_${toISODate(startDate)}_to_${toISODate(endDate)}.csv`;
            downloadCSV(filename, rows);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export report. See console for details.');
        } finally {
            setExporting(false);
        }
    };

    const getItemSummary = (items: any[]) => {
        if (!items || items.length === 0) return 'No items';
        const first = items[0];
        const name = first.product_name || 'Product';
        const variation = first.variation_name ? ` (${first.variation_name})` : '';
        return items.length > 1 ? `${name}${variation} +${items.length - 1} more` : `${name}${variation}`;
    };

    const MetricCard = ({ title, value, trend, icon: Icon, gradient, subtitle }: { title: string; value: string | number; trend?: number; icon: any; gradient: string; subtitle?: string }) => {
        const isPositive = trend !== undefined && trend >= 0;
        return (
            <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} text-white shadow-luxury hover:shadow-hover transition-shadow`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8"></div>
                <div className="relative">
                    <div className="flex items-center gap-2 mb-3 opacity-90">
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{title}</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">{value}</div>
                    {subtitle && <div className="text-xs opacity-80 mb-1">{subtitle}</div>}
                    {trend !== undefined && (
                        <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? 'bg-white/25' : 'bg-charcoal-900/30'}`}>
                            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(trend).toFixed(1)}% vs prev
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const getRankIcon = (index: number) => {
        switch (index) {
            case 0: return <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center shadow-md"><Trophy className="w-4 h-4 text-white" /></div>;
            case 1: return <div className="w-8 h-8 bg-gradient-to-br from-brand-300 to-brand-500 rounded-full flex items-center justify-center shadow-md"><Medal className="w-4 h-4 text-white" /></div>;
            case 2: return <div className="w-8 h-8 bg-gradient-to-br from-cream-200 to-brand-300 rounded-full flex items-center justify-center shadow-md"><Medal className="w-4 h-4 text-brand-800" /></div>;
            default: return <div className="w-8 h-8 bg-cream-100 border border-brand-100 rounded-full flex items-center justify-center text-sm font-bold text-charcoal-500">{index + 1}</div>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cream-100 via-white to-cream-200 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500 border-t-transparent"></div>
            </div>
        );
    }

    const timeframeLabel =
        timeframe === 'all' ? 'of all time' :
        timeframe === 'daily' ? 'today' :
        timeframe === 'weekly' ? 'this week' :
        timeframe === 'monthly' ? 'this month' :
        timeframe === 'yearly' ? 'this year' :
        'in selected range';

    return (
        <div className="min-h-screen bg-gradient-to-br from-cream-100 via-white to-cream-200 font-inter">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

                {/* Header */}
                <div className="flex flex-col gap-4 pb-4 border-b border-brand-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            {onBack && (
                                <button onClick={onBack} className="text-charcoal-500 hover:text-brand-700 flex items-center gap-1 text-sm font-medium mb-1 transition-colors group">
                                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                                </button>
                            )}
                            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-brand-900 tracking-tight">Sales Analytics</h1>
                            <p className="text-charcoal-500 text-sm">Real-time insights, profit tracking, and exportable reports</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow-soft disabled:opacity-50 transition-colors"
                            >
                                <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
                                {exporting ? 'Exporting…' : 'Export CSV'}
                            </button>
                            <button onClick={() => fetchData(true)} disabled={refreshing} className="p-2 bg-white rounded-lg border border-brand-100 text-brand-700 hover:bg-cream-100 transition-colors shadow-soft disabled:opacity-50">
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="flex flex-wrap bg-white rounded-xl p-1 border border-brand-100 shadow-soft">
                            {(['all', 'daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((t) => (
                                <button key={t} onClick={() => setTimeframe(t)} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${timeframe === t ? 'bg-brand-700 text-white shadow-medium' : 'text-charcoal-600 hover:bg-cream-100'}`}>
                                    {t === 'all' ? 'All Time' : t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                        {timeframe === 'custom' && (
                            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-brand-100 shadow-soft">
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    max={customEnd}
                                    className="text-sm bg-transparent border-none focus:outline-none text-charcoal-700"
                                />
                                <span className="text-charcoal-400 text-sm">to</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    min={customStart}
                                    max={toISODate(new Date())}
                                    className="text-sm bg-transparent border-none focus:outline-none text-charcoal-700"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Gross Sales"
                        value={formatCurrency(metrics.current.gross_sales)}
                        trend={calculateTrend(metrics.current.gross_sales, metrics.previous.gross_sales)}
                        icon={DollarSign}
                        gradient="bg-gradient-to-br from-brand-500 to-brand-700"
                    />
                    <MetricCard
                        title="Raw Cost"
                        value={formatCurrency(metrics.current.total_cost)}
                        trend={calculateTrend(metrics.current.total_cost, metrics.previous.total_cost)}
                        icon={Coins}
                        gradient="bg-gradient-to-br from-charcoal-700 to-charcoal-900"
                    />
                    <MetricCard
                        title="Net Profit"
                        value={formatCurrency(metrics.current.net_profit)}
                        trend={calculateTrend(metrics.current.net_profit, metrics.previous.net_profit)}
                        icon={PiggyBank}
                        gradient="bg-gradient-to-br from-brand-700 to-brand-900"
                    />
                    <MetricCard
                        title="Profit Margin"
                        value={`${margin.toFixed(1)}%`}
                        trend={calculateTrend(margin, prevMargin)}
                        icon={Percent}
                        gradient="bg-gradient-to-br from-brand-400 to-brand-600"
                    />
                </div>

                {/* Secondary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <MetricCard
                        title="Total Orders"
                        value={metrics.current.total_orders}
                        trend={calculateTrend(metrics.current.total_orders, metrics.previous.total_orders)}
                        icon={ShoppingBag}
                        gradient="bg-gradient-to-br from-brand-600 to-brand-800"
                    />
                    <MetricCard
                        title="Units Sold"
                        value={metrics.current.total_units}
                        trend={calculateTrend(metrics.current.total_units, metrics.previous.total_units)}
                        icon={Package}
                        gradient="bg-gradient-to-br from-brand-500 to-brand-700"
                    />
                    <MetricCard
                        title="Avg. Order Value"
                        value={formatCurrency(metrics.current.average_order_value)}
                        trend={calculateTrend(metrics.current.average_order_value, metrics.previous.average_order_value)}
                        icon={Activity}
                        gradient="bg-gradient-to-br from-brand-700 to-charcoal-800"
                    />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Top Selling Products */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-brand-100 shadow-luxury overflow-hidden">
                        <div className="p-5 border-b border-brand-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-cream-100 to-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl shadow-medium">
                                    <Trophy className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-heading font-bold text-brand-900">Top Selling Products</h2>
                                    <p className="text-xs text-charcoal-500">Best performers {timeframeLabel}</p>
                                </div>
                            </div>
                            <div className="flex bg-cream-100 rounded-lg p-1 border border-brand-100">
                                <button onClick={() => setSortBy('units')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sortBy === 'units' ? 'bg-white shadow-soft text-brand-700' : 'text-charcoal-500'}`}>Units</button>
                                <button onClick={() => setSortBy('revenue')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sortBy === 'revenue' ? 'bg-white shadow-soft text-brand-700' : 'text-charcoal-500'}`}>Revenue</button>
                                <button onClick={() => setSortBy('profit')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sortBy === 'profit' ? 'bg-white shadow-soft text-brand-700' : 'text-charcoal-500'}`}>Profit</button>
                            </div>
                        </div>
                        <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
                            {sortedRankings.length === 0 ? (
                                <div className="text-center py-12 text-charcoal-400">
                                    <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>No sales data yet</p>
                                </div>
                            ) : (
                                sortedRankings.map((product, index) => {
                                    const primary =
                                        sortBy === 'units' ? product.units_sold :
                                        sortBy === 'revenue' ? formatCurrency(product.revenue) :
                                        formatCurrency(product.profit);
                                    const primaryLabel = sortBy === 'units' ? 'units' : sortBy === 'revenue' ? 'revenue' : 'profit';
                                    return (
                                        <div key={product.product_name} className={`flex items-center gap-4 p-3 rounded-xl hover:bg-cream-100 transition-colors ${index < 3 ? 'bg-gradient-to-r from-cream-100/60 to-transparent' : ''}`}>
                                            {getRankIcon(index)}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-charcoal-900 truncate">{product.product_name}</h4>
                                                    {index === 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-brand-500 to-brand-700 text-white text-[10px] font-bold rounded-full"><Flame className="w-2.5 h-2.5" />HOT</span>}
                                                </div>
                                                <p className="text-xs text-charcoal-500">
                                                    {product.units_sold} units • {formatCurrency(product.revenue)} gross • {formatCurrency(product.profit)} profit
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-brand-900">{primary}</div>
                                                <div className="text-[10px] text-charcoal-400 uppercase font-medium tracking-wider">{primaryLabel}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Recent Sales */}
                    <div className="bg-white rounded-2xl border border-brand-100 shadow-luxury overflow-hidden">
                        <div className="p-5 border-b border-brand-100 bg-gradient-to-r from-cream-100 to-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl shadow-medium">
                                        <ShoppingBag className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-heading font-bold text-brand-900">Recent Sales</h2>
                                        <p className="text-xs text-charcoal-500">Latest transactions</p>
                                    </div>
                                </div>
                                <div className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500"></span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
                            {recentSales.length === 0 ? (
                                <div className="text-center py-12 text-charcoal-400">
                                    <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>No recent sales</p>
                                </div>
                            ) : (
                                recentSales.map((sale) => (
                                    <div key={sale.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-100 hover:bg-cream-200 border border-brand-100/40 transition-colors">
                                        <div className="p-2 bg-white rounded-full shrink-0 border border-brand-100">
                                            <Box className="w-4 h-4 text-brand-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-charcoal-900 truncate">{getItemSummary(sale.order_items)}</p>
                                            <div className="flex items-center gap-2 text-xs text-charcoal-500">
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeAgo(sale.created_at)}</span>
                                                <span>•</span>
                                                <span className="truncate">{sale.customer_name}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-brand-700">{formatCurrency(sale.total_price)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesAnalyticsManager;
