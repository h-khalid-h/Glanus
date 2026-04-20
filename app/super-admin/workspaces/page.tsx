'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
    X, ExternalLink, Search, ChevronLeft, ChevronRight,
    RefreshCw, Building2, Users, Shield, Crown,
    XCircle,
    Cpu, Package, Ticket, Info, Edit2,
    Save, Loader2, UserCheck, CreditCard, Receipt,
    ArrowUpDown, DollarSign, AlertTriangle, FileText,
    BarChart3,
} from 'lucide-react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceRow {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    ownerName: string | null;
    ownerEmail: string | null;
    plan: string | null;
    status: string | null;
    createdAt: string;
    userCount: number;
    assetCount: number;
    agentCount: number;
    lastActivity: string | null;
}

interface WorkspacesData {
    workspaces: WorkspaceRow[];
    meta: { total: number; page: number; limit: number; totalPages: number };
}

interface MemberDetail {
    id: string;
    role: string;
    joinedAt: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        isStaff: boolean;
        emailVerified: boolean;
        platformRole: { id: string; name: string; label: string; color: string; isStaff: boolean } | null;
    };
}

interface WorkspaceDetail {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logo: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    owner: {
        id: string;
        email: string;
        name: string | null;
        platformRole: { id: string; name: string; label: string; color: string } | null;
    };
    subscription: {
        id: string;
        plan: string;
        status: string;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        aiCreditsUsed: number;
        storageUsedMB: number;
        maxAssets: number;
        maxAICreditsPerMonth: number;
        maxStorageMB: number;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        createdAt: string;
        updatedAt: string;
    } | null;
    members: MemberDetail[];
    _count: { members: number; assets: number; agentConnections: number; tickets: number };
}

interface PaymentRow {
    id: string;
    amount: number;
    currency: string;
    status: string;
    plan: string | null;
    description: string | null;
    invoiceUrl: string | null;
    invoicePdf: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    failureReason: string | null;
    paidAt: string | null;
    createdAt: string;
}

interface BillingEventRow {
    id: string;
    type: string;
    description: string;
    previousPlan: string | null;
    newPlan: string | null;
    amount: number | null;
    currency: string | null;
    actorType: string;
    createdAt: string;
}

interface PlatformRoleOption {
    id: string;
    name: string;
    label: string;
    color: string;
    isStaff: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
    FREE:       { label: 'Free',       color: '#64748b' },
    PERSONAL:   { label: 'Personal',   color: '#22c55e' },
    PRO:        { label: 'Pro',        color: '#6366f1' },
    TEAM:       { label: 'Team',       color: '#3b82f6' },
    ENTERPRISE: { label: 'Enterprise', color: '#f59e0b' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    ACTIVE:    { label: 'Active',    color: '#22c55e' },
    TRIALING:  { label: 'Trial',     color: '#3b82f6' },
    PAST_DUE:  { label: 'Past Due',  color: '#f59e0b' },
    CANCELED:  { label: 'Canceled',  color: '#ef4444' },
    UNPAID:    { label: 'Unpaid',    color: '#ef4444' },
    INACTIVE:  { label: 'Inactive',  color: '#64748b' },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    SUCCEEDED: { label: 'Paid',     color: '#22c55e' },
    FAILED:    { label: 'Failed',   color: '#ef4444' },
    PENDING:   { label: 'Pending',  color: '#f59e0b' },
    REFUNDED:  { label: 'Refunded', color: '#6366f1' },
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; Icon: typeof CreditCard }> = {
    plan_change:             { label: 'Plan Change',    color: '#6366f1', Icon: ArrowUpDown },
    payment_succeeded:       { label: 'Payment',        color: '#22c55e', Icon: DollarSign },
    payment_failed:          { label: 'Payment Failed', color: '#ef4444', Icon: AlertTriangle },
    subscription_canceled:   { label: 'Canceled',       color: '#ef4444', Icon: XCircle },
};

function PlanBadge({ plan }: { plan: string | null }) {
    if (!plan) return <span className="text-xs text-muted-foreground/70 italic">No plan</span>;
    const cfg = PLAN_CONFIG[plan] ?? { label: plan, color: '#64748b' };
    return (
        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: cfg.color, backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}30` }}>
            {cfg.label}
        </span>
    );
}

function StatusBadge({ status }: { status: string | null }) {
    if (!status) {
        return <span className="text-xs text-muted-foreground/70 italic">No status</span>;
    }
    const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#64748b' };
    return (
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{ color: cfg.color, backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}25` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
        </span>
    );
}

function fmt(date: string | null) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtCurrency(cents: number | null, currency = 'usd') {
    if (cents == null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

function PaymentStatusBadge({ status }: { status: string }) {
    const cfg = PAYMENT_STATUS_CONFIG[status] ?? { label: status, color: '#64748b' };
    return (
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{ color: cfg.color, backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}25` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
        </span>
    );
}

function UsageBar({ used, max, label, color }: { used: number; max: number; label: string; color: string }) {
    const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground/80">{label}</span>
                <span className="text-[10px] font-mono text-muted-foreground/70">{used} / {max}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Workspace Detail Drawer
// ---------------------------------------------------------------------------

function WorkspaceDetailDrawer({
    workspaceId,
    onClose,
    onRefreshList,
}: {
    workspaceId: string;
    onClose: () => void;
    onRefreshList: () => void;
}) {
    const toast = useToast();
    const [ws, setWs] = useState<WorkspaceDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'members' | 'billing'>('info');

    // Member edit state
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [editRole, setEditRole] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [savingMember, setSavingMember] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [memberError, setMemberError] = useState<string | null>(null);

    // Workspace name edit
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const [savingName, setSavingName] = useState(false);

    // Owner edit state
    const [editingOwner, setEditingOwner] = useState(false);
    const [ownerNameValue, setOwnerNameValue] = useState('');
    const [ownerEmailValue, setOwnerEmailValue] = useState('');
    const [ownerRoleIdValue, setOwnerRoleIdValue] = useState('');
    const [platformRoles, setPlatformRoles] = useState<PlatformRoleOption[]>([]);
    const [savingOwner, setSavingOwner] = useState(false);
    const [ownerPasswordValue, setOwnerPasswordValue] = useState('');
    const [resettingOwnerPassword, setResettingOwnerPassword] = useState(false);
    const [ownerPasswordError, setOwnerPasswordError] = useState<string | null>(null);
    const [ownerPasswordSuccess, setOwnerPasswordSuccess] = useState<string | null>(null);

    // Billing state
    const [payments, setPayments] = useState<PaymentRow[]>([]);
    const [billingEvents, setBillingEvents] = useState<BillingEventRow[]>([]);
    const [billingLoading, setBillingLoading] = useState(false);
    const [billingPage, setBillingPage] = useState(1);
    const [billingMeta, setBillingMeta] = useState({ total: 0, totalPages: 1 });
    const [eventsMeta, setEventsMeta] = useState({ total: 0, totalPages: 1 });

    const fetchDetail = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/workspaces/${workspaceId}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setWs(json.data.workspace);
            setNameValue(json.data.workspace.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load workspace');
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    useEffect(() => {
        fetch('/api/admin/roles', { cache: 'no-store' })
            .then((r) => r.json())
            .then((j) => setPlatformRoles(j.data?.roles ?? []))
            .catch(() => setPlatformRoles([]));
    }, []);

    const fetchBilling = useCallback(async (p = 1) => {
        setBillingLoading(true);
        try {
            const res = await fetch(`/api/admin/workspaces/${workspaceId}/billing?page=${p}&limit=20`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setPayments(json.data.payments);
            setBillingEvents(json.data.billingEvents);
            setBillingMeta(json.data.paymentsMeta);
            setEventsMeta(json.data.eventsMeta);
        } catch {
            toast.error('Error', 'Failed to load billing history');
        } finally {
            setBillingLoading(false);
        }
    }, [workspaceId, toast]);

    useEffect(() => {
        if (activeTab === 'billing') fetchBilling(billingPage);
    }, [activeTab, billingPage, fetchBilling]);

    const handleSaveName = async () => {
        if (!ws || nameValue.trim() === ws.name) { setEditingName(false); return; }
        setSavingName(true);
        try {
            const res = await csrfFetch(`/api/admin/workspaces/${workspaceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nameValue.trim() }),
            });
            if (!res.ok) {
                const j = await res.json();
                throw new Error(j.error?.message ?? 'Update failed');
            }
            await fetchDetail();
            onRefreshList();
            toast.success('Updated', 'Workspace name saved');
        } finally {
            setSavingName(false);
            setEditingName(false);
        }
    };

    const startEditOwner = () => {
        if (!ws) return;
        setOwnerNameValue(ws.owner.name ?? '');
        setOwnerEmailValue(ws.owner.email);
        setOwnerRoleIdValue(ws.owner.platformRole?.id ?? '');
        setOwnerPasswordValue('');
        setOwnerPasswordError(null);
        setOwnerPasswordSuccess(null);
        setEditingOwner(true);
    };

    const handleSaveOwner = async () => {
        if (!ws) return;
        const body: Record<string, unknown> = {};
        const trimName = ownerNameValue.trim();
        const trimEmail = ownerEmailValue.trim().toLowerCase();
        const currentRoleId = ws.owner.platformRole?.id ?? '';
        if (trimName && trimName !== (ws.owner.name ?? '')) body.name = trimName;
        if (trimEmail && trimEmail !== ws.owner.email) body.email = trimEmail;
        if (ownerRoleIdValue && ownerRoleIdValue !== currentRoleId) body.platformRoleId = ownerRoleIdValue;
        if (Object.keys(body).length === 0) { setEditingOwner(false); return; }

        setSavingOwner(true);
        try {
            const res = await csrfFetch(`/api/admin/users/${ws.owner.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const j = await res.json();
                throw new Error(j.error?.message ?? 'Update failed');
            }
            await fetchDetail();
            onRefreshList();
            toast.success('Updated', 'Owner details saved');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Update failed';
            toast.error('Error', msg);
        } finally {
            setSavingOwner(false);
            setEditingOwner(false);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const startEditMember = (member: MemberDetail) => {
        if (member.user.id === ws?.ownerId) return;
        setEditingMemberId(member.id);
        setEditRole(member.role);
        setMemberError(null);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleSaveMember = async (memberId: string) => {
        setSavingMember(true);
        setMemberError(null);
        try {
            const res = await csrfFetch(
                `/api/admin/workspaces/${workspaceId}/members/${memberId}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: editRole }),
                }
            );
            if (!res.ok) {
                const j = await res.json();
                throw new Error(j.error?.message ?? 'Update failed');
            }
            await fetchDetail();
            setEditingMemberId(null);
            toast.success('Updated', 'Member role changed');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Update failed';
            setMemberError(msg);
            toast.error('Error', msg);
        } finally {
            setSavingMember(false);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Remove this member from the workspace?')) return;
        try {
            const res = await csrfFetch(
                `/api/admin/workspaces/${workspaceId}/members/${memberId}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const j = await res.json();
                throw new Error(j.error?.message ?? 'Delete failed');
            }
            await fetchDetail();
            onRefreshList();
            toast.success('Removed', 'Member removed from workspace');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Remove failed';
            setMemberError(msg);
            toast.error('Error', msg);
        }
    };

    const handleResetOwnerPassword = async () => {
        if (!ws) return;
        setOwnerPasswordError(null);
        setOwnerPasswordSuccess(null);

        if (ownerPasswordValue.length < 8) {
            setOwnerPasswordError('Password must be at least 8 characters');
            return;
        }

        setResettingOwnerPassword(true);
        try {
            const res = await csrfFetch(`/api/admin/users/${ws.owner.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: ownerPasswordValue }),
            });

            if (!res.ok) {
                const j = await res.json();
                throw new Error(j.error?.message ?? 'Password reset failed');
            }

            setOwnerPasswordValue('');
            setOwnerPasswordSuccess('Owner password reset. They must change it on next login.');
            toast.success('Updated', 'Owner password has been reset');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Password reset failed';
            setOwnerPasswordError(msg);
            toast.error('Error', msg);
        } finally {
            setResettingOwnerPassword(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer panel */}
            <div className="relative ml-auto h-full w-full max-w-2xl bg-card border-l border-border/60 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-border/60 px-6 py-5 shrink-0">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                            <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            {editingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        value={nameValue}
                                        onChange={(e) => setNameValue(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                                        className="rounded-lg border border-primary/40 bg-muted/30 px-2 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    />
                                    <button onClick={handleSaveName} disabled={savingName}
                                        className="rounded-lg bg-primary/20 p-1.5 text-primary hover:bg-primary/30 transition-colors">
                                        {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                    </button>
                                    <button onClick={() => setEditingName(false)}
                                        className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-semibold text-foreground">
                                        {ws?.name ?? '…'}
                                    </h2>
                                    {ws && (
                                        <button onClick={() => setEditingName(true)}
                                            className="rounded-lg p-1 text-muted-foreground/70 hover:text-primary transition-colors">
                                            <Edit2 className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            )}
                            {ws && (
                                <p className="mt-0.5 text-xs font-mono text-muted-foreground">
                                    /{ws.slug} &nbsp;·&nbsp; {ws.id}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {ws && (
                            <a
                                href={`/workspaces/${ws.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Open
                            </a>
                        )}
                        <button onClick={onClose}
                            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border/60 px-6 shrink-0">
                    {([
                        { key: 'info' as const, label: 'Info & Stats', icon: Info },
                        { key: 'members' as const, label: 'Members (Owner)', icon: Users },
                        { key: 'billing' as const, label: 'Billing', icon: CreditCard },
                    ]).map(({ key, label, icon: TabIcon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <TabIcon className="h-3.5 w-3.5" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}

                    {error && (
                        <div className="m-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {!loading && !error && ws && activeTab === 'info' && (
                        <div className="px-6 py-5 space-y-6">
                            {/* Stats row */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Members', value: ws._count.members, Icon: Users, color: '#6366f1' },
                                    { label: 'Assets', value: ws._count.assets, Icon: Package, color: '#22c55e' },
                                    { label: 'Agents', value: ws._count.agentConnections, Icon: Cpu, color: '#38bdf8' },
                                    { label: 'Tickets', value: ws._count.tickets, Icon: Ticket, color: '#f59e0b' },
                                ].map(({ label, value, Icon, color }) => (
                                    <div key={label} className="rounded-xl border border-border/60 bg-surface-1 p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                                            <Icon className="h-3.5 w-3.5" style={{ color }} />
                                        </div>
                                        <p className="text-xl font-bold text-foreground">{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Plan & Status */}
                            <div className="rounded-xl border border-border/60 bg-surface-1 p-4 space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground/80 mb-1">Plan</p>
                                        <PlanBadge plan={ws.subscription?.plan ?? null} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground/80 mb-1">Status</p>
                                        <StatusBadge status={ws.subscription?.status ?? null} />
                                    </div>
                                    {ws.subscription?.currentPeriodStart && (
                                        <div>
                                            <p className="text-[10px] text-muted-foreground/80 mb-1">Period Start</p>
                                            <p className="text-sm text-foreground">{fmt(ws.subscription.currentPeriodStart)}</p>
                                        </div>
                                    )}
                                    {ws.subscription?.currentPeriodEnd && (
                                        <div>
                                            <p className="text-[10px] text-muted-foreground/80 mb-1">Period End</p>
                                            <p className="text-sm text-foreground">{fmt(ws.subscription.currentPeriodEnd)}</p>
                                        </div>
                                    )}
                                    {ws.subscription?.stripeCustomerId && (
                                        <div className="col-span-2">
                                            <p className="text-[10px] text-muted-foreground/80 mb-1">Stripe Customer</p>
                                            <p className="text-xs text-muted-foreground font-mono truncate">{ws.subscription.stripeCustomerId}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Usage */}
                            {ws.subscription && (
                                <div className="rounded-xl border border-border/60 bg-surface-1 p-4 space-y-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usage</h3>
                                    <div className="space-y-3">
                                        <UsageBar
                                            used={ws._count.assets}
                                            max={ws.subscription.maxAssets}
                                            label="Assets"
                                            color="#22c55e"
                                        />
                                        <UsageBar
                                            used={ws.subscription.aiCreditsUsed}
                                            max={ws.subscription.maxAICreditsPerMonth}
                                            label="AI Credits"
                                            color="#6366f1"
                                        />
                                        <UsageBar
                                            used={ws.subscription.storageUsedMB}
                                            max={ws.subscription.maxStorageMB}
                                            label="Storage (MB)"
                                            color="#38bdf8"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Owner */}
                            <div className="rounded-xl border border-border/60 bg-surface-1 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner</h3>
                                    {!editingOwner && (
                                        <button
                                            onClick={startEditOwner}
                                            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
                                        >
                                            <Edit2 className="h-2.5 w-2.5" /> Edit
                                        </button>
                                    )}
                                </div>
                                {editingOwner ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] text-muted-foreground/80 mb-1 block">Name</label>
                                                <input
                                                    autoFocus
                                                    value={ownerNameValue}
                                                    onChange={(e) => setOwnerNameValue(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOwner(); if (e.key === 'Escape') setEditingOwner(false); }}
                                                    className="w-full rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-muted-foreground/80 mb-1 block">Email</label>
                                                <input
                                                    type="email"
                                                    value={ownerEmailValue}
                                                    onChange={(e) => setOwnerEmailValue(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOwner(); if (e.key === 'Escape') setEditingOwner(false); }}
                                                    className="w-full rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-muted-foreground/80 mb-1 block">Platform Role</label>
                                                <select
                                                    value={ownerRoleIdValue}
                                                    onChange={(e) => setOwnerRoleIdValue(e.target.value)}
                                                    className="role-select"
                                                >
                                                    <option value="">Current Role</option>
                                                    {platformRoles.map((role) => (
                                                        <option key={role.id} value={role.id}>
                                                            {role.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] text-muted-foreground/80 mb-1 block">Reset Password</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="password"
                                                    value={ownerPasswordValue}
                                                    onChange={(e) => setOwnerPasswordValue(e.target.value)}
                                                    placeholder="New password (min 8 chars)"
                                                    minLength={8}
                                                    className="flex-1 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                />
                                                <button
                                                    onClick={handleResetOwnerPassword}
                                                    disabled={resettingOwnerPassword || ownerPasswordValue.length < 8}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 disabled:opacity-40 transition-colors"
                                                >
                                                    {resettingOwnerPassword ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                    Reset
                                                </button>
                                            </div>
                                            {ownerPasswordError && (
                                                <p className="mt-1 text-xs text-destructive">{ownerPasswordError}</p>
                                            )}
                                            {ownerPasswordSuccess && (
                                                <p className="mt-1 text-xs text-emerald-400">{ownerPasswordSuccess}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button onClick={handleSaveOwner} disabled={savingOwner}
                                                className="inline-flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors">
                                                {savingOwner ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                Save
                                            </button>
                                            <button onClick={() => setEditingOwner(false)}
                                                className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                                            <Crown className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {ws.owner.name ?? ws.owner.email}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{ws.owner.email}</p>
                                        </div>
                                        {ws.owner.platformRole && (
                                            <span className="ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                                                style={{
                                                    color: ws.owner.platformRole.color,
                                                    backgroundColor: `${ws.owner.platformRole.color}18`,
                                                    borderColor: `${ws.owner.platformRole.color}30`,
                                                }}>
                                                <Shield className="h-2.5 w-2.5" />
                                                {ws.owner.platformRole.label}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Meta */}
                            <div className="rounded-xl border border-border/60 bg-surface-1 p-4 space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h3>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                                    {[
                                        ['Created', fmt(ws.createdAt)],
                                        ['Updated', fmt(ws.updatedAt)],
                                        ['Slug', `/${ws.slug}`],
                                        ['ID', ws.id],
                                        ['Description', ws.description ?? '—'],
                                        ['Deleted', ws.deletedAt ? fmt(ws.deletedAt) : 'No'],
                                    ].map(([label, val]) => (
                                        <div key={label}>
                                            <p className="text-[10px] text-muted-foreground/80 mb-0.5">{label}</p>
                                            <p className="text-sm text-foreground font-mono truncate">{val}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && !error && ws && activeTab === 'members' && (
                        <div className="px-6 py-5 space-y-4">
                            <div className="rounded-xl border border-border/60 bg-surface-1 px-4 py-3">
                                <p className="text-xs text-muted-foreground">
                                    Members tab is restricted to the workspace owner.
                                </p>
                            </div>

                            <div className="rounded-xl border border-border/60 bg-surface-1 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace Owner</h3>
                                    {!editingOwner && (
                                        <button
                                            onClick={startEditOwner}
                                            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
                                        >
                                            <Edit2 className="h-2.5 w-2.5" /> Edit
                                        </button>
                                    )}
                                </div>

                                {editingOwner ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] text-muted-foreground/80 mb-1 block">Name</label>
                                                <input
                                                    autoFocus
                                                    value={ownerNameValue}
                                                    onChange={(e) => setOwnerNameValue(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOwner(); if (e.key === 'Escape') setEditingOwner(false); }}
                                                    className="w-full rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-muted-foreground/80 mb-1 block">Email</label>
                                                <input
                                                    type="email"
                                                    value={ownerEmailValue}
                                                    onChange={(e) => setOwnerEmailValue(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOwner(); if (e.key === 'Escape') setEditingOwner(false); }}
                                                    className="w-full rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-muted-foreground/80 mb-1 block">Platform Role</label>
                                                <select
                                                    value={ownerRoleIdValue}
                                                    onChange={(e) => setOwnerRoleIdValue(e.target.value)}
                                                    className="role-select"
                                                >
                                                    <option value="">Current Role</option>
                                                    {platformRoles.map((role) => (
                                                        <option key={role.id} value={role.id}>
                                                            {role.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] text-muted-foreground/80 mb-1 block">Reset Password</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="password"
                                                    value={ownerPasswordValue}
                                                    onChange={(e) => setOwnerPasswordValue(e.target.value)}
                                                    placeholder="New password (min 8 chars)"
                                                    minLength={8}
                                                    className="flex-1 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                />
                                                <button
                                                    onClick={handleResetOwnerPassword}
                                                    disabled={resettingOwnerPassword || ownerPasswordValue.length < 8}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 disabled:opacity-40 transition-colors"
                                                >
                                                    {resettingOwnerPassword ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                    Reset
                                                </button>
                                            </div>
                                            {ownerPasswordError && (
                                                <p className="mt-1 text-xs text-destructive">{ownerPasswordError}</p>
                                            )}
                                            {ownerPasswordSuccess && (
                                                <p className="mt-1 text-xs text-emerald-400">{ownerPasswordSuccess}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleSaveOwner}
                                                disabled={savingOwner}
                                                className="inline-flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
                                            >
                                                {savingOwner ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingOwner(false)}
                                                className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                                            <Crown className="h-4 w-4" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-sm font-medium text-foreground truncate">
                                                    {ws.owner.name ?? ws.owner.email}
                                                </p>
                                                <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                                                    <Crown className="h-2 w-2" /> Owner
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">{ws.owner.email}</p>
                                        </div>

                                        {ws.owner.platformRole && (
                                            <span
                                                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-semibold border"
                                                style={{
                                                    color: ws.owner.platformRole.color,
                                                    backgroundColor: `${ws.owner.platformRole.color}15`,
                                                    borderColor: `${ws.owner.platformRole.color}25`,
                                                }}
                                            >
                                                {ws.owner.platformRole.label}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Billing Tab */}
                    {!loading && !error && ws && activeTab === 'billing' && (
                        <div className="px-6 py-5 space-y-6">
                            {billingLoading && (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                            )}

                            {!billingLoading && (
                                <>
                                    {/* Payments Table */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <Receipt className="h-3.5 w-3.5" /> Payments
                                            </h3>
                                            <span className="text-[10px] text-muted-foreground/70">{billingMeta.total} total</span>
                                        </div>

                                        {payments.length === 0 ? (
                                            <div className="flex flex-col items-center py-10 text-muted-foreground/70">
                                                <CreditCard className="h-8 w-8 mb-2" />
                                                <p className="text-sm">No payments recorded</p>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-border/60 bg-surface-1 overflow-hidden">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="border-b border-border/60">
                                                            {['Date', 'Amount', 'Status', 'Plan', 'Period', 'Invoice'].map((col) => (
                                                                <th key={col} className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                                                                    {col}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {payments.map((p) => (
                                                            <tr key={p.id} className="border-b border-border/20 hover:bg-muted/5 transition-colors">
                                                                <td className="px-3 py-2.5 text-xs text-foreground">{fmt(p.paidAt ?? p.createdAt)}</td>
                                                                <td className="px-3 py-2.5 text-xs font-semibold text-foreground">{fmtCurrency(p.amount, p.currency)}</td>
                                                                <td className="px-3 py-2.5"><PaymentStatusBadge status={p.status} /></td>
                                                                <td className="px-3 py-2.5"><PlanBadge plan={p.plan} /></td>
                                                                <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                                                                    {p.periodStart && p.periodEnd
                                                                        ? `${fmt(p.periodStart)} – ${fmt(p.periodEnd)}`
                                                                        : '—'}
                                                                </td>
                                                                <td className="px-3 py-2.5">
                                                                    {p.invoiceUrl ? (
                                                                        <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary transition-colors">
                                                                            <FileText className="h-3 w-3" /> View
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-[11px] text-muted-foreground/30">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>

                                                {billingMeta.totalPages > 1 && (
                                                    <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
                                                        <p className="text-[10px] text-muted-foreground/80">
                                                            Page {billingPage} of {billingMeta.totalPages}
                                                        </p>
                                                        <div className="flex items-center gap-1">
                                                            <button disabled={billingPage <= 1} onClick={() => setBillingPage((p) => p - 1)}
                                                                className="rounded-lg border border-border/60 p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                                                                <ChevronLeft className="h-3 w-3" />
                                                            </button>
                                                            <button disabled={billingPage >= billingMeta.totalPages} onClick={() => setBillingPage((p) => p + 1)}
                                                                className="rounded-lg border border-border/60 p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                                                                <ChevronRight className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Billing Events */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <BarChart3 className="h-3.5 w-3.5" /> Billing Events
                                            </h3>
                                            <span className="text-[10px] text-muted-foreground/70">{eventsMeta.total} total</span>
                                        </div>

                                        {billingEvents.length === 0 ? (
                                            <div className="flex flex-col items-center py-8 text-muted-foreground/70">
                                                <Receipt className="h-6 w-6 mb-2" />
                                                <p className="text-sm">No billing events</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {billingEvents.map((evt) => {
                                                    const cfg = EVENT_TYPE_CONFIG[evt.type] ?? { label: evt.type, color: '#64748b', Icon: Receipt };
                                                    const EvtIcon = cfg.Icon;
                                                    return (
                                                        <div key={evt.id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-1 px-4 py-3">
                                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5"
                                                                style={{ backgroundColor: `${cfg.color}15` }}>
                                                                <EvtIcon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                                                                    {evt.amount != null && (
                                                                        <span className="text-xs font-mono text-foreground">{fmtCurrency(evt.amount, evt.currency ?? 'usd')}</span>
                                                                    )}
                                                                    <span className="ml-auto text-[10px] text-muted-foreground/70">{fmt(evt.createdAt)}</span>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{evt.description}</p>
                                                                {(evt.previousPlan || evt.newPlan) && (
                                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                                        {evt.previousPlan && <PlanBadge plan={evt.previousPlan} />}
                                                                        {evt.previousPlan && evt.newPlan && <span className="text-[10px] text-muted-foreground/70">&rarr;</span>}
                                                                        {evt.newPlan && <PlanBadge plan={evt.newPlan} />}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SuperAdminWorkspacesPage() {
    const [data, setData] = useState<WorkspacesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [planFilter, _setPlanFilter] = useState('');
    const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
    const [actingAsId, setActingAsId] = useState<string | null>(null);
    const [actAsError, setActAsError] = useState<string | null>(null);

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchData = useCallback(async (p: number, s: string, plan: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/api/admin/workspaces', window.location.origin);
            url.searchParams.set('page', String(p));
            url.searchParams.set('limit', '100');
            if (s) url.searchParams.set('search', s);
            if (plan) url.searchParams.set('plan', plan);

            const res = await fetch(url.toString(), { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load workspaces');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(1, '', ''); }, [fetchData]);

    const handleSearch = useCallback((value: string) => {
        setSearch(value);
        setPage(1);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => fetchData(1, value, planFilter), 350);
    }, [fetchData, planFilter]);

    const handlePageChange = useCallback((newPage: number) => {
        setPage(newPage);
        fetchData(newPage, search, planFilter);
    }, [fetchData, search, planFilter]);

    const handleRefresh = useCallback(() => {
        fetchData(page, search, planFilter);
    }, [fetchData, page, search, planFilter]);

    const handleActAs = useCallback(async (workspaceId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (actingAsId) return;
        setActingAsId(workspaceId);
        setActAsError(null);
        try {
            const res = await csrfFetch('/api/admin/act-as', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId }),
            });
            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.error?.message ?? `HTTP ${res.status}`);
            }
            await res.json();
            // Pre-set localStorage so the WorkspaceProvider picks the correct
            // workspace immediately on the next page load instead of falling back
            // to the admin's previously-selected workspace.
            localStorage.setItem('currentWorkspaceId', workspaceId);
            // The app uses a Zustand workspace store keyed by ID, not slug routes.
            // Force a full page load to /dashboard so the new session token is read
            // and the workspace store rehydrates with the impersonated user's workspaces.
            window.location.href = '/dashboard';
        } catch (err) {
            setActAsError(err instanceof Error ? err.message : 'Impersonation failed');
            setActingAsId(null);
        }
    }, [actingAsId]);

    const total = data?.meta.total ?? 0;
    const totalPages = data?.meta.totalPages ?? 1;
    const workspaces = data?.workspaces ?? [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Workspace Management</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {total} workspace{total !== 1 ? 's' : ''} across all tenants
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {actAsError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
                    <span>Impersonation failed: {actAsError}</span>
                    <button onClick={() => setActAsError(null)} className="ml-3 text-destructive hover:text-destructive">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Table card */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/80" />
                        <input
                            type="text"
                            placeholder="Search workspaces…"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full rounded-xl border border-border/60 bg-muted/10 pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                    {search && (
                        <button onClick={() => handleSearch('')}
                            className="rounded-xl p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border/60">
                                {['Workspace', 'Owner', 'Plan', 'Status', 'Members', 'Assets', 'Agents', 'Created', ''].map((col) => (
                                    <th key={col} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                    </td>
                                </tr>
                            )}
                            {!loading && workspaces.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center text-sm text-muted-foreground/70">
                                        No workspaces found
                                    </td>
                                </tr>
                            )}
                            {!loading && workspaces.map((ws) => (
                                <tr key={ws.id}
                                    className="border-b border-border/20 hover:bg-muted/5 transition-colors group cursor-pointer"
                                    onClick={() => setOpenDrawerId(ws.id)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                                <Building2 className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{ws.name}</p>
                                                <p className="text-xs text-muted-foreground font-mono">/{ws.slug}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate max-w-[160px]">
                                                {ws.ownerName ?? ws.ownerEmail ?? '—'}
                                            </p>
                                            {ws.ownerName && ws.ownerEmail && (
                                                <p className="text-[11px] text-muted-foreground/80 truncate max-w-[160px]">{ws.ownerEmail}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <PlanBadge plan={ws.plan} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={ws.status} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1 text-sm text-foreground">
                                            <Users className="h-3.5 w-3.5 text-muted-foreground/70" />
                                            {ws.userCount}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1 text-sm text-foreground">
                                            <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
                                            {ws.assetCount}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1 text-sm text-foreground">
                                            <Cpu className="h-3.5 w-3.5 text-muted-foreground/70" />
                                            {ws.agentCount}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-muted-foreground">{fmt(ws.createdAt)}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={(e) => handleActAs(ws.id, e)}
                                                disabled={actingAsId === ws.id}
                                                title="Act as Owner"
                                                className="rounded-xl px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-all"
                                            >
                                                {actingAsId === ws.id
                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                    : <UserCheck className="h-3 w-3" />
                                                }
                                                Act as Owner
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setOpenDrawerId(ws.id); }}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                                            >
                                                <Info className="h-3 w-3" />
                                                Details
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                            Page {page} of {totalPages} &nbsp;·&nbsp; {total} total
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                disabled={page <= 1}
                                onClick={() => handlePageChange(page - 1)}
                                className="rounded-xl border border-border/60 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => handlePageChange(page + 1)}
                                className="rounded-xl border border-border/60 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail drawer */}
            {openDrawerId && (
                <WorkspaceDetailDrawer
                    workspaceId={openDrawerId}
                    onClose={() => setOpenDrawerId(null)}
                    onRefreshList={handleRefresh}
                />
            )}
        </div>
    );
}
