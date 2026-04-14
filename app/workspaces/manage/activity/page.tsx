'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import {
    Activity, FileText, AlertTriangle, Cpu, Brain,
    ChevronDown, Filter, RefreshCw,
} from 'lucide-react';

interface ActivityItem {
    id: string;
    type: 'audit' | 'alert' | 'agent' | 'insight';
    title: string;
    description: string;
    severity?: string;
    actor?: { name: string | null; email: string } | null;
    resource?: { type: string; id: string; name?: string | null } | null;
    timestamp: string;
}

const typeConfig: Record<string, { icon: typeof Activity; color: string; bg: string; label: string }> = {
    audit: { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Audit' },
    alert: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-amber-500/10', label: 'Alert' },
    agent: { icon: Cpu, color: 'text-cortex', bg: 'bg-cortex/10', label: 'Agent' },
    insight: { icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Insight' },
};

type FilterType = 'all' | 'audit' | 'alert' | 'agent' | 'insight';

export default function ActivityPage() {
    const workspaceId = useWorkspaceId();

    const [items, setItems] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [filter, setFilter] = useState<FilterType>('all');

    const fetchActivity = useCallback(async (cursor?: string | null, append = false) => {
        if (!workspaceId) return;

        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            const qs = new URLSearchParams({ limit: '40' });
            if (cursor) qs.set('cursor', cursor);
            if (filter !== 'all') qs.set('types', filter);

            const res = await csrfFetch(`/api/workspaces/${workspaceId}/activity?${qs}`);
            if (!res.ok) throw new Error('Failed to load activity');

            const data = await res.json();
            const result = data.data || {};

            if (append) {
                setItems(prev => [...prev, ...(result.items || [])]);
            } else {
                setItems(result.items || []);
            }
            setNextCursor(result.nextCursor || null);
            setHasMore(result.hasMore || false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load activity');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [workspaceId, filter]);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    const handleLoadMore = () => {
        if (nextCursor && hasMore && !loadingMore) {
            fetchActivity(nextCursor, true);
        }
    };

    const formatRelativeTime = (ts: string) => {
        const diff = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(ts).toLocaleDateString();
    };

    const groupByDate = (items: ActivityItem[]): Map<string, ActivityItem[]> => {
        const groups = new Map<string, ActivityItem[]>();
        for (const item of items) {
            const date = new Date(item.timestamp).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            });
            if (!groups.has(date)) groups.set(date, []);
            groups.get(date)!.push(item);
        }
        return groups;
    };

    if (loading) return <PageSpinner text="Loading activity…" />;
    if (error) return <ErrorState title="Activity Error" description={error} onRetry={() => { setError(null); fetchActivity(); }} />;

    const grouped = groupByDate(items);
    const filterOptions: { value: FilterType; label: string }[] = [
        { value: 'all', label: 'All Activity' },
        { value: 'audit', label: 'Audit Logs' },
        { value: 'alert', label: 'Alerts' },
        { value: 'agent', label: 'Agents' },
        { value: 'insight', label: 'Insights' },
    ];

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Activity className="text-primary" size={20} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Activity Feed</h1>
                        <p className="text-muted-foreground text-sm">Unified timeline across your workspace</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <select
                            value={filter}
                            onChange={e => setFilter(e.target.value as FilterType)}
                            className="bg-muted border border-border text-foreground rounded-xl pl-8 pr-8 py-2 text-sm outline-none appearance-none"
                        >
                            {filterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                    <button onClick={() => fetchActivity()} className="btn-secondary p-2" title="Refresh">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Timeline */}
            {items.length === 0 ? (
                <div className="card text-center py-16">
                    <Activity className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
                    <p className="text-muted-foreground">No activity found.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Array.from(grouped.entries()).map(([date, dayItems]) => (
                        <div key={date}>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 sticky top-14 z-10 bg-background py-1">{date}</div>
                            <div className="relative pl-6 border-l-2 border-border space-y-0.5">
                                {dayItems.map(item => {
                                    const config = typeConfig[item.type] || typeConfig.audit;
                                    const Icon = config.icon;
                                    return (
                                        <div key={item.id} className="relative flex items-start gap-3 py-3 group hover:bg-muted/30 rounded-xl px-3 -ml-3 transition">
                                            {/* Dot on timeline */}
                                            <div className="absolute -left-[21px] top-5 w-3 h-3 rounded-full border-2 border-border bg-surface-1 group-hover:border-primary transition" />

                                            <div className={`shrink-0 w-8 h-8 rounded-xl ${config.bg} flex items-center justify-center mt-0.5`}>
                                                <Icon size={15} className={config.color} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${config.bg} ${config.color}`}>{config.label}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                                                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/60">
                                                    {item.actor && <span>{item.actor.name || item.actor.email}</span>}
                                                    <span>{formatRelativeTime(item.timestamp)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Load More */}
            {hasMore && (
                <div className="text-center mt-8">
                    <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="btn-secondary px-6"
                    >
                        {loadingMore ? 'Loading…' : 'Load More'}
                    </button>
                </div>
            )}
        </>
    );
}
