'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    DollarSign, CreditCard, TrendingUp, AlertTriangle,
    Users, ArrowUpRight, ArrowDownRight, RefreshCw,
    Receipt, Settings, Clock, ChevronLeft, ChevronRight,
    ExternalLink, Search, Filter, Sparkles,
} from 'lucide-react';
import { KpiCard } from '@/components/super-admin/KpiCard';
import { csrfFetch } from '@/lib/api/csrfFetch';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RevenueMetrics {
    mrr: number;
    totalRevenue: number;
    activeSubscriptions: number;
    pastDueSubscriptions: number;
    canceledThisMonth: number;
    newSubscriptionsThisMonth: number;
    planDistribution: Record<string, number>;
    revenueByMonth: { month: string; revenue: number; count: number }[];
}

interface PaymentRecord {
    id: string;
    workspaceId: string;
    workspaceName: string;
    amount: number;
    currency: string;
    status: string;
    plan: string | null;
    description: string | null;
    invoiceUrl: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    failureReason: string | null;
    paidAt: string | null;
    createdAt: string;
}

interface BillingEvent {
    id: string;
    workspaceId: string | null;
    workspaceName: string | null;
    type: string;
    description: string;
    previousPlan: string | null;
    newPlan: string | null;
    amount: number | null;
    actorType: string;
    createdAt: string;
}

interface PlanConfig {
    id: string;
    plan: string;
    name: string;
    description: string | null;
    highlighted: boolean;
    stripePriceId: string | null;
    stripePriceIdPublic: string | null;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    maxAssets: number;
    maxAICreditsPerMonth: number;
    maxStorageMB: number;
    maxMembers: number;
    features: string[] | null;
    isActive: boolean;
    sortOrder: number;
}

// Format cents to dollars
function formatCurrency(cents: number, currency = 'usd'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(cents / 100);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    });
}

function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab types
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'payments' | 'events' | 'plans';

const TABS: { id: Tab; label: string; icon: typeof DollarSign }[] = [
    { id: 'overview', label: 'Revenue', icon: TrendingUp },
    { id: 'payments', label: 'Payments', icon: Receipt },
    { id: 'events', label: 'Events', icon: Clock },
    { id: 'plans', label: 'Plans', icon: Settings },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status badges
// ─────────────────────────────────────────────────────────────────────────────

const paymentStatusStyles: Record<string, string> = {
    SUCCEEDED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    FAILED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    REFUNDED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const eventTypeStyles: Record<string, string> = {
    payment_succeeded: 'bg-emerald-500/10 text-emerald-400',
    payment_failed: 'bg-rose-500/10 text-rose-400',
    checkout_completed: 'bg-blue-500/10 text-blue-400',
    plan_change: 'bg-violet-500/10 text-violet-400',
    subscription_canceled: 'bg-amber-500/10 text-amber-400',
    manual_plan_override: 'bg-cyan-500/10 text-cyan-400',
    plan_config_updated: 'bg-indigo-500/10 text-indigo-400',
};

const planBadgeStyles: Record<string, string> = {
    FREE: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    PERSONAL: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    TEAM: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    ENTERPRISE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BillingDashboardPage() {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [paymentsTotal, setPaymentsTotal] = useState(0);
    const [paymentPage, setPaymentPage] = useState(1);
    const [paymentFilter, setPaymentFilter] = useState('');
    const [events, setEvents] = useState<BillingEvent[]>([]);
    const [eventsTotal, setEventsTotal] = useState(0);
    const [eventPage, setEventPage] = useState(1);
    const [plans, setPlans] = useState<PlanConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingPlan, setEditingPlan] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<PlanConfig>>({});
    const [saving, setSaving] = useState(false);
    const [overrideModal, setOverrideModal] = useState(false);
    const [overrideForm, setOverrideForm] = useState({ workspaceId: '', plan: 'PERSONAL', reason: '' });

    // ── Fetchers ─────────────────────────────────────────────────────────────

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/billing', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setMetrics(json.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load metrics');
        }
    }, []);

    const fetchPayments = useCallback(async (page = 1, status?: string) => {
        try {
            const params = new URLSearchParams({ page: String(page), limit: '15' });
            if (status) params.set('status', status);
            const res = await fetch(`/api/admin/billing/payments?${params}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setPayments(json.data.payments);
            setPaymentsTotal(json.data.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load payments');
        }
    }, []);

    const fetchEvents = useCallback(async (page = 1) => {
        try {
            const res = await fetch(`/api/admin/billing/events?page=${page}&limit=20`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setEvents(json.data.events);
            setEventsTotal(json.data.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load events');
        }
    }, []);

    const fetchPlans = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/billing/plans', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setPlans(json.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load plans');
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        setError(null);
        const timeout = setTimeout(() => setLoading(false), 15000); // Safety: prevent infinite loading
        Promise.all([fetchMetrics(), fetchPayments(), fetchEvents(), fetchPlans()])
            .finally(() => { clearTimeout(timeout); setLoading(false); });
    }, [fetchMetrics, fetchPayments, fetchEvents, fetchPlans]);

    useEffect(() => {
        fetchPayments(paymentPage, paymentFilter || undefined);
    }, [paymentPage, paymentFilter, fetchPayments]);

    useEffect(() => {
        fetchEvents(eventPage);
    }, [eventPage, fetchEvents]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleSavePlan = async () => {
        if (!editingPlan) return;
        setSaving(true);
        try {
            const res = await csrfFetch('/api/admin/billing/plans', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: editingPlan, ...editForm }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || `HTTP ${res.status}`);
            }
            await fetchPlans();
            setEditingPlan(null);
            setEditForm({});
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save plan');
        } finally {
            setSaving(false);
        }
    };

    const handleOverride = async () => {
        setSaving(true);
        try {
            const res = await csrfFetch('/api/admin/billing/override', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(overrideForm),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || `HTTP ${res.status}`);
            }
            setOverrideModal(false);
            setOverrideForm({ workspaceId: '', plan: 'PERSONAL', reason: '' });
            await Promise.all([fetchMetrics(), fetchEvents()]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to override plan');
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = () => {
        setLoading(true);
        setError(null);
        Promise.all([fetchMetrics(), fetchPayments(paymentPage, paymentFilter || undefined), fetchEvents(eventPage), fetchPlans()])
            .finally(() => setLoading(false));
    };

    // ── Render ───────────────────────────────────────────────────────────────

    const paymentPages = Math.ceil(paymentsTotal / 15);
    const eventPages = Math.ceil(eventsTotal / 20);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100">Billing & Revenue</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Manage plans, track payments, and monitor revenue
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setOverrideModal(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/10"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Override Plan
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-300 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">dismiss</button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-slate-800/50 bg-slate-900/30 p-1">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={[
                            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                            activeTab === id
                                ? 'bg-slate-800/80 text-slate-100 shadow-sm'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30',
                        ].join(' ')}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW TAB ──────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <KpiCard
                            title="Monthly Recurring Revenue"
                            value={metrics ? formatCurrency(metrics.mrr) : '—'}
                            icon={<DollarSign className="h-5 w-5" />}
                            accent="emerald"
                            loading={loading}
                        />
                        <KpiCard
                            title="Total Revenue"
                            value={metrics ? formatCurrency(metrics.totalRevenue) : '—'}
                            icon={<TrendingUp className="h-5 w-5" />}
                            accent="blue"
                            loading={loading}
                        />
                        <KpiCard
                            title="Active Subscriptions"
                            value={metrics?.activeSubscriptions ?? '—'}
                            subtitle={metrics?.pastDueSubscriptions ? `${metrics.pastDueSubscriptions} past due` : undefined}
                            icon={<Users className="h-5 w-5" />}
                            accent="violet"
                            loading={loading}
                        />
                        <KpiCard
                            title="New This Month"
                            value={metrics?.newSubscriptionsThisMonth ?? '—'}
                            subtitle={metrics?.canceledThisMonth ? `${metrics.canceledThisMonth} canceled` : undefined}
                            icon={<CreditCard className="h-5 w-5" />}
                            accent="cyan"
                            loading={loading}
                        />
                    </div>

                    {/* Plan distribution */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {/* Plan Distribution */}
                        <div className="rounded-2xl border border-slate-800/50 bg-[#0a1628]/60 p-6">
                            <h3 className="mb-4 text-sm font-semibold text-slate-300">Plan Distribution</h3>
                            {metrics?.planDistribution && Object.keys(metrics.planDistribution).length > 0 ? (
                                <div className="space-y-3">
                                    {Object.entries(metrics.planDistribution).map(([plan, count]) => {
                                        const total = Object.values(metrics.planDistribution).reduce((a, b) => a + b, 0);
                                        const pct = total > 0 ? (count / total * 100) : 0;
                                        return (
                                            <div key={plan}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium ${planBadgeStyles[plan] || planBadgeStyles.FREE}`}>
                                                        {plan}
                                                    </span>
                                                    <span className="text-slate-400">{count} ({pct.toFixed(0)}%)</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-slate-800/60">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600">No subscription data yet</p>
                            )}
                        </div>

                        {/* Revenue Trend */}
                        <div className="rounded-2xl border border-slate-800/50 bg-[#0a1628]/60 p-6">
                            <h3 className="mb-4 text-sm font-semibold text-slate-300">Revenue Trend (12 months)</h3>
                            {metrics?.revenueByMonth && metrics.revenueByMonth.length > 0 ? (
                                <div className="space-y-2">
                                    {metrics.revenueByMonth.map(({ month, revenue, count }) => {
                                        const maxRev = Math.max(...metrics.revenueByMonth.map(r => r.revenue));
                                        const pct = maxRev > 0 ? (revenue / maxRev * 100) : 0;
                                        return (
                                            <div key={month} className="flex items-center gap-3">
                                                <span className="w-16 shrink-0 text-xs text-slate-500">{month}</span>
                                                <div className="flex-1 h-3 overflow-hidden rounded-full bg-slate-800/60">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="w-20 shrink-0 text-right text-xs text-slate-400">
                                                    {formatCurrency(revenue)}
                                                </span>
                                                <span className="w-8 shrink-0 text-right text-[10px] text-slate-600">
                                                    ×{count}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600">No revenue data yet</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── PAYMENTS TAB ──────────────────────────────────────────────── */}
            {activeTab === 'payments' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                            <select
                                value={paymentFilter}
                                onChange={(e) => { setPaymentFilter(e.target.value); setPaymentPage(1); }}
                                className="appearance-none rounded-xl border border-slate-800/50 bg-slate-900/50 pl-9 pr-8 py-2 text-xs text-slate-300 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                            >
                                <option value="">All statuses</option>
                                <option value="SUCCEEDED">Succeeded</option>
                                <option value="FAILED">Failed</option>
                                <option value="PENDING">Pending</option>
                                <option value="REFUNDED">Refunded</option>
                            </select>
                        </div>
                        <span className="text-xs text-slate-600">{paymentsTotal} total payments</span>
                    </div>

                    {/* Table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-800/50 bg-[#0a1628]/60">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800/50">
                                        <th className="px-4 py-3 font-medium text-slate-500">Date</th>
                                        <th className="px-4 py-3 font-medium text-slate-500">Workspace</th>
                                        <th className="px-4 py-3 font-medium text-slate-500">Plan</th>
                                        <th className="px-4 py-3 font-medium text-slate-500">Amount</th>
                                        <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                                        <th className="px-4 py-3 font-medium text-slate-500">Period</th>
                                        <th className="px-4 py-3 font-medium text-slate-500">Invoice</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/30">
                                    {payments.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-600">
                                                No payments recorded yet
                                            </td>
                                        </tr>
                                    ) : payments.map((p) => (
                                        <tr key={p.id} className="transition-colors hover:bg-slate-800/20">
                                            <td className="px-4 py-3 text-slate-400">{formatDate(p.paidAt || p.createdAt)}</td>
                                            <td className="px-4 py-3 font-medium text-slate-300">{p.workspaceName}</td>
                                            <td className="px-4 py-3">
                                                {p.plan && (
                                                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${planBadgeStyles[p.plan] || planBadgeStyles.FREE}`}>
                                                        {p.plan}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-slate-300">{formatCurrency(p.amount, p.currency)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${paymentStatusStyles[p.status] || ''}`}>
                                                    {p.status}
                                                </span>
                                                {p.failureReason && (
                                                    <span className="ml-1 text-[10px] text-rose-400/70" title={p.failureReason}>⚠</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {p.periodStart && p.periodEnd
                                                    ? `${formatDate(p.periodStart)} — ${formatDate(p.periodEnd)}`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {p.invoiceUrl && (
                                                    <a
                                                        href={p.invoiceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-indigo-400 hover:underline"
                                                    >
                                                        View <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {paymentPages > 1 && (
                            <div className="flex items-center justify-between border-t border-slate-800/50 px-4 py-3">
                                <span className="text-xs text-slate-600">
                                    Page {paymentPage} of {paymentPages}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setPaymentPage(p => Math.max(1, p - 1))}
                                        disabled={paymentPage <= 1}
                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800/40 disabled:opacity-30"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setPaymentPage(p => Math.min(paymentPages, p + 1))}
                                        disabled={paymentPage >= paymentPages}
                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800/40 disabled:opacity-30"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── EVENTS TAB ────────────────────────────────────────────────── */}
            {activeTab === 'events' && (
                <div className="space-y-4">
                    <div className="text-xs text-slate-600">{eventsTotal} total events</div>

                    <div className="space-y-2">
                        {events.length === 0 ? (
                            <div className="rounded-2xl border border-slate-800/50 bg-[#0a1628]/60 px-6 py-8 text-center text-sm text-slate-600">
                                No billing events recorded yet
                            </div>
                        ) : events.map((e) => (
                            <div key={e.id} className="rounded-xl border border-slate-800/50 bg-[#0a1628]/60 px-4 py-3 transition-colors hover:bg-slate-800/20">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${eventTypeStyles[e.type] || 'bg-slate-500/10 text-slate-400'}`}>
                                                {e.type.replace(/_/g, ' ')}
                                            </span>
                                            {e.actorType === 'admin' && (
                                                <span className="inline-flex rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400">
                                                    manual
                                                </span>
                                            )}
                                            {e.newPlan && (
                                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${planBadgeStyles[e.newPlan] || planBadgeStyles.FREE}`}>
                                                    {e.previousPlan ? `${e.previousPlan} → ` : ''}{e.newPlan}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">{e.description}</p>
                                        {e.workspaceName && (
                                            <p className="text-[10px] text-slate-600 mt-0.5">{e.workspaceName}</p>
                                        )}
                                    </div>
                                    <div className="shrink-0 text-right">
                                        {e.amount != null && (
                                            <p className="text-xs font-mono text-slate-300">{formatCurrency(e.amount)}</p>
                                        )}
                                        <p className="text-[10px] text-slate-600">{formatDateTime(e.createdAt)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {eventPages > 1 && (
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-600">Page {eventPage} of {eventPages}</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setEventPage(p => Math.max(1, p - 1))}
                                    disabled={eventPage <= 1}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800/40 disabled:opacity-30"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setEventPage(p => Math.min(eventPages, p + 1))}
                                    disabled={eventPage >= eventPages}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800/40 disabled:opacity-30"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── PLANS TAB ─────────────────────────────────────────────────── */}
            {activeTab === 'plans' && (
                <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                        Configure plan pricing, limits, and Stripe price IDs. Changes take effect for new subscriptions.
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                        {['FREE', 'PERSONAL', 'TEAM', 'ENTERPRISE'].map((planKey) => {
                            const config = plans.find(p => p.plan === planKey);
                            const isEditing = editingPlan === planKey;

                            return (
                                <div
                                    key={planKey}
                                    className={`rounded-2xl border bg-[#0a1628]/60 p-5 transition-all ${
                                        isEditing
                                            ? 'border-indigo-500/30 ring-1 ring-indigo-500/20'
                                            : 'border-slate-800/50 hover:border-slate-700/50'
                                    }`}
                                >
                                    {/* Plan header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex rounded-lg border px-3 py-1 text-sm font-bold ${planBadgeStyles[planKey] || planBadgeStyles.FREE}`}>
                                                {planKey}
                                            </span>
                                            {config?.highlighted && (
                                                <span className="text-[10px] text-amber-400">★ Featured</span>
                                            )}
                                        </div>
                                        {!isEditing ? (
                                            <button
                                                onClick={() => {
                                                    setEditingPlan(planKey);
                                                    setEditForm(config || {});
                                                }}
                                                className="text-xs text-indigo-400 hover:underline"
                                            >
                                                Edit
                                            </button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setEditingPlan(null); setEditForm({}); }}
                                                    className="text-xs text-slate-500 hover:text-slate-300"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSavePlan}
                                                    disabled={saving}
                                                    className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50"
                                                >
                                                    {saving ? 'Saving…' : 'Save'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {isEditing ? (
                                        /* ── Edit form ── */
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Name</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.name ?? config?.name ?? ''}
                                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                        className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Monthly Price (cents)</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.priceMonthly ?? config?.priceMonthly ?? 0}
                                                        onChange={(e) => setEditForm({ ...editForm, priceMonthly: parseInt(e.target.value) || 0 })}
                                                        className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Stripe Price ID (server)</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.stripePriceId ?? config?.stripePriceId ?? ''}
                                                        onChange={(e) => setEditForm({ ...editForm, stripePriceId: e.target.value })}
                                                        className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                                        placeholder="price_..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Stripe Price ID (public)</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.stripePriceIdPublic ?? config?.stripePriceIdPublic ?? ''}
                                                        onChange={(e) => setEditForm({ ...editForm, stripePriceIdPublic: e.target.value })}
                                                        className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                                        placeholder="price_... (used for checkout)"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Yearly Price (cents)</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.priceYearly ?? config?.priceYearly ?? 0}
                                                        onChange={(e) => setEditForm({ ...editForm, priceYearly: parseInt(e.target.value) || 0 })}
                                                        className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Max Assets</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.maxAssets ?? config?.maxAssets ?? 5}
                                                        onChange={(e) => setEditForm({ ...editForm, maxAssets: parseInt(e.target.value) || 0 })}
                                                        className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">AI Credits/mo</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.maxAICreditsPerMonth ?? config?.maxAICreditsPerMonth ?? 100}
                                                        onChange={(e) => setEditForm({ ...editForm, maxAICreditsPerMonth: parseInt(e.target.value) || 0 })}
                                                        className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Storage (MB)</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.maxStorageMB ?? config?.maxStorageMB ?? 1024}
                                                        onChange={(e) => setEditForm({ ...editForm, maxStorageMB: parseInt(e.target.value) || 0 })}
                                                        className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Max Members</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.maxMembers ?? config?.maxMembers ?? 1}
                                                        onChange={(e) => setEditForm({ ...editForm, maxMembers: parseInt(e.target.value) || 0 })}
                                                        className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex items-end gap-4">
                                                    <label className="flex items-center gap-2 text-xs text-slate-400">
                                                        <input
                                                            type="checkbox"
                                                            checked={editForm.highlighted ?? config?.highlighted ?? false}
                                                            onChange={(e) => setEditForm({ ...editForm, highlighted: e.target.checked })}
                                                            className="rounded border-slate-700 bg-slate-900"
                                                        />
                                                        Featured
                                                    </label>
                                                    <label className="flex items-center gap-2 text-xs text-slate-400">
                                                        <input
                                                            type="checkbox"
                                                            checked={editForm.isActive ?? config?.isActive ?? true}
                                                            onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                                                            className="rounded border-slate-700 bg-slate-900"
                                                        />
                                                        Active
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── Read-only display ── */
                                        <div className="space-y-3">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-bold text-slate-100">
                                                    {config ? formatCurrency(config.priceMonthly) : (planKey === 'FREE' ? '$0' : 'Not configured')}
                                                </span>
                                                {config && config.priceMonthly > 0 && (
                                                    <span className="text-xs text-slate-500">/mo</span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Assets</span>
                                                    <span className="text-slate-400">{config?.maxAssets ?? '—'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Members</span>
                                                    <span className="text-slate-400">{config?.maxMembers ?? '—'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">AI Credits</span>
                                                    <span className="text-slate-400">{config?.maxAICreditsPerMonth?.toLocaleString() ?? '—'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Storage</span>
                                                    <span className="text-slate-400">
                                                        {config?.maxStorageMB ? `${(config.maxStorageMB / 1024).toFixed(0)} GB` : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                            {config?.stripePriceId && (
                                                <p className="font-mono text-[10px] text-slate-700 truncate" title={config.stripePriceId}>
                                                    Server: {config.stripePriceId}
                                                </p>
                                            )}
                                            {config?.stripePriceIdPublic && (
                                                <p className="font-mono text-[10px] text-slate-700 truncate" title={config.stripePriceIdPublic}>
                                                    Public: {config.stripePriceIdPublic}
                                                </p>
                                            )}
                                            {config && !config.stripePriceIdPublic && planKey !== 'FREE' && planKey !== 'ENTERPRISE' && (
                                                <p className="text-[10px] text-amber-500/70 italic">
                                                    ⚠ No public Stripe Price ID — upgrade button will be disabled
                                                </p>
                                            )}
                                            {!config && (
                                                <p className="text-xs text-slate-600 italic">Click Edit to configure this plan</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── OVERRIDE MODAL ────────────────────────────────────────────── */}
            {overrideModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-800/50 bg-[#0b1424] p-6 shadow-2xl">
                        <h2 className="text-lg font-bold text-slate-100 mb-1">Override Workspace Plan</h2>
                        <p className="text-xs text-slate-500 mb-5">Manually change a workspace&apos;s subscription plan. This bypasses Stripe.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Workspace ID</label>
                                <input
                                    type="text"
                                    value={overrideForm.workspaceId}
                                    onChange={(e) => setOverrideForm({ ...overrideForm, workspaceId: e.target.value })}
                                    placeholder="clxxxxxxxxxx..."
                                    className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">New Plan</label>
                                <select
                                    value={overrideForm.plan}
                                    onChange={(e) => setOverrideForm({ ...overrideForm, plan: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                >
                                    <option value="FREE">FREE</option>
                                    <option value="PERSONAL">PERSONAL</option>
                                    <option value="TEAM">TEAM</option>
                                    <option value="ENTERPRISE">ENTERPRISE</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Reason (optional)</label>
                                <input
                                    type="text"
                                    value={overrideForm.reason}
                                    onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                                    placeholder="e.g., Partner trial extension"
                                    className="mt-1 w-full rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setOverrideModal(false)}
                                className="rounded-xl px-4 py-2 text-xs text-slate-500 hover:text-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleOverride}
                                disabled={!overrideForm.workspaceId || saving}
                                className="rounded-xl bg-cyan-500/20 px-4 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                            >
                                {saving ? 'Applying…' : 'Apply Override'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
