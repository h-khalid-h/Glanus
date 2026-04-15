'use client';

import { useEffect, useState } from 'react';
import type { Metadata } from 'next';
import {
    Building2, Users, Activity, Package, Ticket,
    Cpu, Radio, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { KpiCard } from '@/components/super-admin/KpiCard';
import { ActivityFeed } from '@/components/super-admin/ActivityFeed';
import type { PlatformKPIs, RecentAuditEvent, PlatformAlert } from '@/lib/services/SuperAdminService';

// Workaround: page-level metadata must be exported from a Server Component.
// This page is Client for interactivity; the metadata is set via layout.tsx default.

interface DashboardData {
    kpis: PlatformKPIs;
    recentActivity: RecentAuditEvent[];
    alerts: PlatformAlert[];
}

const severityStyles: Record<string, string> = {
    info: 'border-cortex/20 bg-cortex/5 text-cortex',
    warning: 'border-amber-500/20 bg-amber-500/5 text-warning',
    critical: 'border-rose-500/20 bg-rose-500/5 text-rose-400',
};

const severityIcon: Record<string, string> = {
    info: '🔵',
    warning: '⚠️',
    critical: '🚨',
};

export default function SuperAdminOverviewPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error ?? `HTTP ${res.status}`);
            }
            const json = await res.json();
            setData(json.data);
            setLastRefresh(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const id = setInterval(fetchData, 60_000); // auto-refresh every 60s
        return () => clearInterval(id);
    }, []);

    const kpis = data?.kpis;

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Platform Overview</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Real-time metrics across all tenants{lastRefresh && (
                            <> · <span className="text-muted-foreground/60">Updated {lastRefresh.toLocaleTimeString()}</span></>
                        )}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-50"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
                    {error}
                </div>
            )}

            {/* KPI Grid */}
            <section aria-label="Platform KPIs">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                    <KpiCard
                        title="Total Workspaces"
                        value={kpis?.totalWorkspaces ?? 0}
                        icon={<Building2 className="h-5 w-5" />}
                        accent="blue"
                        loading={loading}
                    />
                    <KpiCard
                        title="Total Users"
                        value={kpis?.totalUsers ?? 0}
                        icon={<Users className="h-5 w-5" />}
                        accent="violet"
                        loading={loading}
                    />
                    <KpiCard
                        title="Active (24h)"
                        value={kpis?.activeWorkspaces24h ?? 0}
                        subtitle="Workspaces with recent activity"
                        icon={<Activity className="h-5 w-5" />}
                        accent="emerald"
                        loading={loading}
                    />
                    <KpiCard
                        title="Total Assets"
                        value={kpis?.totalAssets ?? 0}
                        icon={<Package className="h-5 w-5" />}
                        accent="cyan"
                        loading={loading}
                    />
                    <KpiCard
                        title="Open Tickets"
                        value={kpis?.openTickets ?? 0}
                        icon={<Ticket className="h-5 w-5" />}
                        accent="amber"
                        loading={loading}
                    />
                    <KpiCard
                        title="Total Agents"
                        value={kpis?.totalAgents ?? 0}
                        icon={<Cpu className="h-5 w-5" />}
                        accent="blue"
                        loading={loading}
                    />
                    <KpiCard
                        title="Online Agents"
                        value={kpis?.onlineAgents ?? 0}
                        icon={<Radio className="h-5 w-5" />}
                        accent="emerald"
                        loading={loading}
                    />
                </div>
            </section>

            {/* Alerts + Activity */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Alerts */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-foreground">Platform Alerts</h2>
                        <span className="text-xs text-muted-foreground/60">Last hour</span>
                    </div>
                    {loading ? (
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-16 rounded-xl bg-card animate-pulse border border-border/60" />
                            ))}
                        </div>
                    ) : (data?.alerts?.length ?? 0) === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card py-10 text-sm text-muted-foreground">
                            <span className="text-2xl">✅</span>
                            All systems normal
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {data?.alerts.map((alert, i) => (
                                <div
                                    key={i}
                                    className={`rounded-xl border px-4 py-3 ${severityStyles[alert.severity]}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{severityIcon[alert.severity]}</span>
                                        <p className="text-sm font-semibold truncate">{alert.workspaceName}</p>
                                    </div>
                                    <p className="mt-1 text-xs opacity-75">{alert.message}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* System Monitoring placeholder */}
                    <div className="rounded-2xl border border-border/40 bg-muted/30 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground/60" />
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Monitoring</p>
                        </div>
                        <p className="text-xs text-muted-foreground/60">
                            CPU, Memory &amp; DB metrics require an external Prometheus / Datadog integration.
                        </p>
                        <a
                            href="https://docs.glanus.io/monitoring"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            Configure monitoring →
                        </a>
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="lg:col-span-2">
                    <ActivityFeed events={data?.recentActivity ?? []} loading={loading} />
                </div>
            </section>
        </div>
    );
}
