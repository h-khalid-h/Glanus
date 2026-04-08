'use client';

import { useEffect, useState, useCallback } from 'react';
import { TopWorkspacesChart, DailyActivityChart } from '@/components/super-admin/AnalyticsChart';
import type { UsageAnalytics } from '@/lib/services/SuperAdminService';

const RANGE_OPTIONS = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
] as const;

export default function SuperAdminAnalyticsPage() {
    const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState<number>(30);

    const fetchData = useCallback(async (d: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/analytics?days=${d}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setAnalytics(json.data.analytics);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(days); }, [fetchData, days]);

    const handleRangeChange = (d: number) => {
        setDays(d);
        fetchData(d);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100">Usage Analytics</h1>
                    <p className="mt-1 text-sm text-slate-500">Cross-tenant usage breakdown by workspace</p>
                </div>
                {/* Date range picker */}
                <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
                    {RANGE_OPTIONS.map(({ label, value }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => handleRangeChange(value)}
                            className={[
                                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                                days === value
                                    ? 'bg-indigo-500/20 text-indigo-300 shadow-inner'
                                    : 'text-slate-500 hover:text-slate-300',
                            ].join(' ')}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
                    {error}
                </div>
            )}

            {/* Daily activity timeline */}
            <DailyActivityChart
                data={analytics?.activityByDay ?? []}
                days={days}
                loading={loading}
            />

            {/* Top workspace charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <TopWorkspacesChart
                    data={analytics?.topByAssets ?? []}
                    metric="assetCount"
                    label="Asset Count"
                    loading={loading}
                />
                <TopWorkspacesChart
                    data={analytics?.topByActivity ?? []}
                    metric="auditEvents"
                    label={`Activity (${days}d)`}
                    loading={loading}
                />
                <TopWorkspacesChart
                    data={analytics?.workspaceUsage ?? []}
                    metric="userCount"
                    label="User Count"
                    loading={loading}
                />
                <TopWorkspacesChart
                    data={analytics?.workspaceUsage ?? []}
                    metric="openTickets"
                    label="Open Tickets"
                    loading={loading}
                />
            </div>

            {/* Full usage table */}
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 overflow-hidden">
                <div className="border-b border-slate-800/60 px-5 py-4">
                    <h2 className="text-base font-semibold text-slate-100">Workspace Usage Summary</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Last {days} days · ordered by activity</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-800/60">
                                {['Workspace', 'Assets', 'Users', 'Agents', `Events (${days}d)`, 'Open Tickets'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-800/40 animate-pulse">
                                        {Array.from({ length: 6 }).map((__, j) => (
                                            <td key={j} className="px-4 py-3">
                                                <div className="h-4 w-16 rounded bg-slate-800" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (analytics?.workspaceUsage ?? []).length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No data available</td>
                                </tr>
                            ) : (
                                analytics?.workspaceUsage.map((ws) => (
                                    <tr key={ws.workspaceId} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-200">{ws.workspaceName}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{ws.assetCount.toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{ws.userCount.toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{ws.agentCount.toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-indigo-400 font-semibold">{ws.auditEvents.toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-amber-400">{ws.openTickets.toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
