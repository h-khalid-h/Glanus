'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { BaseNotification } from '@/components/workspace/NotificationPopover';
import {
    Bell, Trash2, CheckCheck, AlertTriangle,
    Info, Sparkles, X, ChevronDown, RefreshCw,
} from 'lucide-react';

type SeverityFilter = 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO' | 'AI_INSIGHT';

const DISMISSED_KEY_PREFIX = 'glanus_notif_dismissed_';
const PAGE_SIZE = 20;

function getDismissedSet(workspaceId: string): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = localStorage.getItem(`${DISMISSED_KEY_PREFIX}${workspaceId}`);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
}

function persistDismissed(workspaceId: string, set: Set<string>) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${DISMISSED_KEY_PREFIX}${workspaceId}`, JSON.stringify([...set]));
}

export default function NotificationsPage() {
    const params = useParams();
    const workspaceId = params.id as string;

    const [notifications, setNotifications] = useState<BaseNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<SeverityFilter>('ALL');
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [showDismissed, setShowDismissed] = useState(false);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const fetchNotifications = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/notifications?limit=200`);
            if (!res.ok) throw new Error('Failed to fetch notifications');
            const data = await res.json();
            setNotifications(data.data?.notifications || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load notifications. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchNotifications();
        setDismissed(getDismissedSet(workspaceId));
    }, [workspaceId, fetchNotifications]);

    const handleDismiss = (id: string) => {
        const next = new Set(dismissed);
        next.add(id);
        setDismissed(next);
        persistDismissed(workspaceId, next);
    };

    const handleDismissAll = () => {
        const next = new Set(dismissed);
        filteredNotifications.forEach(n => next.add(n.id));
        setDismissed(next);
        persistDismissed(workspaceId, next);
    };

    const handleRestoreAll = () => {
        setDismissed(new Set());
        persistDismissed(workspaceId, new Set());
    };

    // Filtered + sorted
    const filteredNotifications = useMemo(() => {
        let items = notifications;
        if (activeFilter === 'AI_INSIGHT') {
            items = items.filter(n => n.type === 'AI_INSIGHT');
        } else if (activeFilter !== 'ALL') {
            items = items.filter(n => n.severity === activeFilter);
        }
        if (!showDismissed) {
            items = items.filter(n => !dismissed.has(n.id));
        }
        return items;
    }, [notifications, activeFilter, dismissed, showDismissed]);

    const visibleNotifications = filteredNotifications.slice(0, visibleCount);
    const hasMore = visibleCount < filteredNotifications.length;

    // Count per category
    const counts = useMemo(() => {
        const active = notifications.filter(n => !dismissed.has(n.id));
        return {
            ALL: active.length,
            CRITICAL: active.filter(n => n.severity === 'CRITICAL').length,
            WARNING: active.filter(n => n.severity === 'WARNING').length,
            INFO: active.filter(n => n.severity === 'INFO').length,
            AI_INSIGHT: active.filter(n => n.type === 'AI_INSIGHT').length,
        };
    }, [notifications, dismissed]);

    const filterTabs: Array<{ key: SeverityFilter; label: string; icon: typeof Bell; color: string }> = [
        { key: 'ALL', label: 'All', icon: Bell, color: 'text-foreground' },
        { key: 'CRITICAL', label: 'Critical', icon: AlertTriangle, color: 'text-red-400' },
        { key: 'WARNING', label: 'Warning', icon: AlertTriangle, color: 'text-amber-400' },
        { key: 'INFO', label: 'Info', icon: Info, color: 'text-blue-400' },
        { key: 'AI_INSIGHT', label: 'AI Insights', icon: Sparkles, color: 'text-cortex' },
    ];

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications & Intelligence</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Unified timeline detailing Oracle predictions, Nerve anomalies, and systemic Audit Logs.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { fetchNotifications(); setVisibleCount(PAGE_SIZE); }}
                        className="flex items-center gap-1.5 px-3 py-2 border border-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-800/50 transition">
                        <RefreshCw size={13} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-800 rounded-xl">
                {filterTabs.map(tab => (
                    <button key={tab.key}
                        onClick={() => { setActiveFilter(tab.key); setVisibleCount(PAGE_SIZE); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeFilter === tab.key
                            ? 'bg-slate-800 text-foreground shadow-sm'
                            : 'text-slate-400 hover:text-foreground hover:bg-slate-800/50'
                            }`}>
                        <tab.icon size={13} className={activeFilter === tab.key ? tab.color : ''} />
                        {tab.label}
                        {counts[tab.key] > 0 && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tab.key === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                tab.key === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-slate-700 text-slate-300'
                                }`}>{counts[tab.key]}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-800 text-nerve focus:ring-nerve/50" />
                        Show dismissed
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    {dismissed.size > 0 && (
                        <button onClick={handleRestoreAll}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-foreground border border-slate-700 rounded-lg transition">
                            <CheckCheck size={12} />
                            Restore All ({dismissed.size})
                        </button>
                    )}
                    {filteredNotifications.length > 0 && (
                        <button onClick={handleDismissAll}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 border border-slate-700 rounded-lg transition">
                            <Trash2 size={12} />
                            Dismiss All
                        </button>
                    )}
                </div>
            </div>

            {/* Notification List */}
            <div className="card">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-nerve border-t-transparent" />
                    </div>
                ) : error ? (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-500">
                        {error}
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="rounded-full bg-surface-2 p-4 text-muted-foreground mb-4">
                            <Bell size={32} strokeWidth={1} />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">
                            {activeFilter !== 'ALL' ? `No ${activeFilter.replace('_', ' ').toLowerCase()} notifications` : 'No notifications'}
                        </h3>
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                            {dismissed.size > 0
                                ? 'All notifications have been dismissed. Toggle "Show dismissed" to see them.'
                                : 'When Oracle predicts capacity burnout or systemic audits occur, traces will populate this timeline.'}
                        </p>
                    </div>
                ) : (
                    <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                        {visibleNotifications.map((notif, idx) => {
                            const actorName: string | null = notif.metadata?.actor ? String(notif.metadata.actor) : null;
                            const recommendations: string[] | null = notif.type === 'AI_INSIGHT' && notif.metadata && Array.isArray(notif.metadata.recommendations)
                                ? (notif.metadata.recommendations as string[]) : null;
                            return (
                                <div key={notif.id || idx} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${dismissed.has(notif.id) ? 'opacity-40' : ''}`}>
                                    {/* Timeline Dot */}
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface-1 bg-surface-2 text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${notif.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/20' :
                                        notif.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-500 border-amber-500/20' :
                                            notif.type === 'AI_INSIGHT' ? 'bg-cortex/20 text-cortex border-cortex/20' : ''
                                        }`}>
                                        {notif.type === 'AI_INSIGHT' ? (
                                            <Sparkles size={16} />
                                        ) : notif.severity === 'CRITICAL' ? (
                                            <AlertTriangle size={16} />
                                        ) : (
                                            <Info size={16} />
                                        )}
                                    </div>

                                    {/* Card Body */}
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] rounded-xl border border-border bg-surface-1 p-4 shadow-sm transition-transform hover:-translate-y-1 relative">
                                        {/* Dismiss button */}
                                        {!dismissed.has(notif.id) && (
                                            <button onClick={() => handleDismiss(notif.id)}
                                                className="absolute top-2 right-2 p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100">
                                                <X size={14} />
                                            </button>
                                        )}
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between pr-6">
                                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                                    {notif.type === 'AI_INSIGHT' && (
                                                        <span className="text-xs uppercase font-bold text-nerve bg-nerve/10 px-2 py-0.5 rounded-sm">
                                                            Oracle
                                                        </span>
                                                    )}
                                                    {notif.severity === 'CRITICAL' && (
                                                        <span className="text-xs uppercase font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-sm">
                                                            Critical
                                                        </span>
                                                    )}
                                                    {notif.severity === 'WARNING' && notif.type !== 'AI_INSIGHT' && (
                                                        <span className="text-xs uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm">
                                                            Warning
                                                        </span>
                                                    )}
                                                    {notif.title}
                                                </h3>
                                                <time className="text-xs text-muted-foreground mr-1 shrink-0">
                                                    {new Date(notif.createdAt).toLocaleString(undefined, {
                                                        month: 'short', day: 'numeric',
                                                        hour: 'numeric', minute: 'numeric'
                                                    })}
                                                </time>
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {notif.description || String((notif.metadata as Record<string, unknown>)?.description || 'Routine system trace processed.')}
                                            </div>

                                            {/* Actor info */}
                                            {actorName && (
                                                <div className="text-xs text-slate-500 mt-1">By {actorName}</div>
                                            )}

                                            {/* AI Recommendations */}
                                            {recommendations && (
                                                <div className="mt-3 rounded-lg bg-surface-2 p-3 border border-border/50">
                                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                                                        <Sparkles size={12} className="text-oracle" />
                                                        Mitigation Strategy
                                                    </h4>
                                                    <ul className="list-inside list-disc space-y-1 pl-1">
                                                        {recommendations.map((rec, rIdx) => (
                                                            <li key={rIdx} className="text-xs text-slate-400">
                                                                {rec}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}    </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Load More */}
                        {hasMore && (
                            <div className="text-center pt-4">
                                <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                    className="flex items-center gap-1.5 mx-auto px-4 py-2 text-xs font-medium text-nerve hover:text-foreground border border-nerve/20 hover:border-nerve/50 rounded-lg transition">
                                    <ChevronDown size={14} />
                                    Load More ({filteredNotifications.length - visibleCount} remaining)
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
