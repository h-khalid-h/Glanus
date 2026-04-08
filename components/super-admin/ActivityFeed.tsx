'use client';

import type { RecentAuditEvent } from '@/lib/services/SuperAdminService';

interface ActivityFeedProps {
    events: RecentAuditEvent[];
    loading?: boolean;
}

function actionColor(action: string): string {
    const lower = action.toLowerCase();
    if (lower.includes('delete') || lower.includes('remove')) return 'text-rose-400';
    if (lower.includes('create') || lower.includes('invite') || lower.includes('add')) return 'text-emerald-400';
    if (lower.includes('update') || lower.includes('edit') || lower.includes('change')) return 'text-blue-400';
    if (lower.includes('login') || lower.includes('auth')) return 'text-violet-400';
    return 'text-slate-400';
}

function actionIcon(action: string): string {
    const lower = action.toLowerCase();
    if (lower.includes('delete') || lower.includes('remove')) return '🗑';
    if (lower.includes('create') || lower.includes('add')) return '✦';
    if (lower.includes('update') || lower.includes('edit')) return '✎';
    if (lower.includes('login')) return '⚡';
    if (lower.includes('invite')) return '✉';
    return '◈';
}

function relativeTime(date: Date | string): string {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function formatAction(action: string): string {
    return action
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ActivityFeed({ events, loading = false }: ActivityFeedProps) {
    return (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <div className="border-b border-slate-800/60 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-100">Live Activity</h2>
                <p className="text-xs text-slate-500 mt-0.5">Cross-tenant audit feed</p>
            </div>

            <div className="divide-y divide-slate-800/40 max-h-[480px] overflow-y-auto scrollbar-thin">
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex gap-3 px-5 py-3 animate-pulse">
                            <div className="h-7 w-7 shrink-0 rounded-full bg-slate-800" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3.5 w-40 rounded bg-slate-800" />
                                <div className="h-3 w-24 rounded bg-slate-800" />
                            </div>
                        </div>
                    ))
                ) : events.length === 0 ? (
                    <div className="px-5 py-10 text-center text-slate-500 text-sm">No recent activity</div>
                ) : (
                    events.map((event) => (
                        <div key={event.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-800/20 transition-colors">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800/60 text-sm">
                                {actionIcon(event.action)}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-slate-200 truncate">
                                    <span className={`font-semibold ${actionColor(event.action)}`}>
                                        {formatAction(event.action)}
                                    </span>
                                    {event.resourceType && (
                                        <span className="text-slate-500"> · {event.resourceType}</span>
                                    )}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600 truncate">
                                    {event.workspaceName && (
                                        <span className="rounded bg-slate-800/60 px-1.5 py-0.5 text-slate-400 font-medium">
                                            {event.workspaceName}
                                        </span>
                                    )}
                                    {event.userEmail && (
                                        <span className="truncate">{event.userEmail}</span>
                                    )}
                                </div>
                            </div>
                            <time className="shrink-0 text-xs text-slate-600 mt-0.5" dateTime={new Date(event.createdAt).toISOString()}>
                                {relativeTime(event.createdAt)}
                            </time>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
