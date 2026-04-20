'use client';

import { useState, useCallback } from 'react';
import type { WorkspaceRow } from '@/lib/services/SuperAdminService';

interface WorkspaceTableProps {
    workspaces: WorkspaceRow[];
    total: number;
    page: number;
    limit: number;
    loading?: boolean;
    onPageChange: (page: number) => void;
    onSearch: (search: string) => void;
    onViewWorkspace: (ws: WorkspaceRow) => void;
}

function planBadge(plan: string | null) {
    const map: Record<string, string> = {
        FREE: 'bg-muted text-muted-foreground',
        PERSONAL: 'bg-cortex/10 text-cortex',
        TEAM: 'bg-cortex/10 text-cortex',
        ENTERPRISE: 'bg-amber-500/10 text-warning',
    };
    const cls = map[plan ?? ''] ?? 'bg-muted text-muted-foreground';
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{plan ?? '—'}</span>;
}

function statusBadge(status: string | null) {
    const map: Record<string, string> = {
        ACTIVE: 'bg-emerald-500/10 text-emerald-400',
        TRIALING: 'bg-cortex/10 text-cortex',
        PAST_DUE: 'bg-amber-500/10 text-warning',
        CANCELED: 'bg-muted text-muted-foreground',
        UNPAID: 'bg-destructive/10 text-destructive',
    };
    const cls = map[status ?? ''] ?? 'bg-muted text-muted-foreground';
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{status ?? '—'}</span>;
}

function relativeTime(date: Date | string | null): string {
    if (!date) return 'Never';
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export function WorkspaceTable({
    workspaces,
    total,
    page,
    limit,
    loading = false,
    onPageChange,
    onSearch,
    onViewWorkspace,
}: WorkspaceTableProps) {
    const [searchValue, setSearchValue] = useState('');
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchValue(e.target.value);
        onSearch(e.target.value);
    }, [onSearch]);

    return (
        <div className="rounded-2xl border border-border/60 bg-card backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-foreground">All Workspaces</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{total.toLocaleString()} total tenants</p>
                </div>
                <div className="relative w-full sm:w-72">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                        id="workspace-search"
                        type="text"
                        placeholder="Search workspaces…"
                        value={searchValue}
                        onChange={handleSearch}
                        className="w-full rounded-lg border border-border bg-muted/40 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-cortex/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/60">
                            {['Workspace', 'Owner', 'Plan', 'Status', 'Users', 'Assets', 'Agents', 'Last Activity', ''].map((h) => (
                                <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i} className="border-b border-border/40 animate-pulse">
                                    {Array.from({ length: 9 }).map((__, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-4 w-20 rounded bg-muted" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : workspaces.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                                    No workspaces found
                                </td>
                            </tr>
                        ) : (
                            workspaces.map((ws) => (
                                <tr
                                    key={ws.id}
                                    className="group border-b border-border/40 hover:bg-muted/30 transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="font-medium text-foreground">{ws.name}</p>
                                            <p className="text-xs text-muted-foreground/60 font-mono">{ws.slug}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[160px]">
                                        {ws.ownerEmail ?? '—'}
                                    </td>
                                    <td className="px-4 py-3">{planBadge(ws.plan)}</td>
                                    <td className="px-4 py-3">{statusBadge(ws.status)}</td>
                                    <td className="px-4 py-3 text-foreground font-mono text-xs">{ws.userCount.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-foreground font-mono text-xs">{ws.assetCount.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-foreground font-mono text-xs">{ws.agentCount.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                        {relativeTime(ws.lastActivity)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => onViewWorkspace(ws)}
                                            className="invisible group-hover:visible rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-foreground transition-colors hover:border-cortex/40 hover:text-cortex"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
                <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} · {total.toLocaleString()} workspaces
                </p>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                        className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        ← Prev
                    </button>
                    <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => onPageChange(page + 1)}
                        className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Next →
                    </button>
                </div>
            </div>
        </div>
    );
}
