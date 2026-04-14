'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RecentAuditEvent } from '@/lib/services/SuperAdminService';

function actionColor(action: string): string {
    const lower = action.toLowerCase();
    if (lower.includes('delete') || lower.includes('remove')) return 'bg-rose-500/10 text-rose-400';
    if (lower.includes('create') || lower.includes('add') || lower.includes('invite')) return 'bg-emerald-500/10 text-emerald-400';
    if (lower.includes('update') || lower.includes('edit')) return 'bg-cortex/10 text-cortex';
    if (lower.includes('login') || lower.includes('auth')) return 'bg-violet-500/10 text-violet-400';
    return 'bg-muted text-muted-foreground';
}

function formatAction(action: string): string {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SuperAdminAuditPage() {
    const [events, setEvents] = useState<RecentAuditEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setEvents(json.data.recentActivity ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load audit log');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Global Audit Log</h1>
                    <p className="mt-1 text-sm text-muted-foreground">All actions across every workspace</p>
                </div>
                <button
                    type="button"
                    onClick={fetchData}
                    disabled={loading}
                    className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-50"
                >
                    Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
                    {error}
                </div>
            )}

            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/60">
                                {['Time', 'Action', 'Resource Type', 'Workspace', 'User'].map((h) => (
                                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 12 }).map((_, i) => (
                                    <tr key={i} className="border-b border-border/40 animate-pulse">
                                        {Array.from({ length: 5 }).map((__, j) => (
                                            <td key={j} className="px-5 py-3.5">
                                                <div className="h-4 rounded bg-muted w-24" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : events.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-muted-foreground">No audit events found</td>
                                </tr>
                            ) : (
                                events.map((event) => (
                                    <tr key={event.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground/60 font-mono">
                                            {new Date(event.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${actionColor(event.action)}`}>
                                                {formatAction(event.action)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-muted-foreground">
                                            {event.resourceType ?? '—'}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {event.workspaceName ? (
                                                <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-foreground">
                                                    {event.workspaceName}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-muted-foreground truncate max-w-[200px]">
                                            {event.userEmail ?? '—'}
                                        </td>
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
