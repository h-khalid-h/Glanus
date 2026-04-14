'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/utils';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/ui/EmptyState';
import { useWorkspace } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import Link from 'next/link';

interface DashboardData {
    stats: {
        totalAssets: number;
        totalUsers: number;
        activeSessions: number;
        pendingInsights: number;
    };
    recentAssets: Array<{
        id: string;
        name: string;
        status: string;
        assetType: string;
        category?: string;
        assignedTo?: { name: string } | null;
        updatedAt: string;
    }>;
    activeSessionsList: Array<{
        id: string;
        agentId: string;
        status: string;
        lastSeen: string;
        startedAt?: string;
        asset: { id: string; name: string };
        user?: { name: string };
    }>;
}

const statCards = [
    {
        key: 'totalAssets',
        label: 'Total Assets',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
        ),
        color: 'nerve',
    },
    {
        key: 'totalUsers',
        label: 'Total Users',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
        ),
        color: 'cortex',
    },
    {
        key: 'activeSessions',
        label: 'Active Sessions',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
        ),
        color: 'oracle',
    },
    {
        key: 'pendingInsights',
        label: 'AI Insights',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
        ),
        color: 'reflex',
    },
];

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    nerve: { bg: 'bg-nerve/10', text: 'text-nerve', border: 'border-nerve/20' },
    cortex: { bg: 'bg-cortex/10', text: 'text-cortex', border: 'border-cortex/20' },
    oracle: { bg: 'bg-oracle/10', text: 'text-oracle', border: 'border-oracle/20' },
    reflex: { bg: 'bg-reflex/10', text: 'text-reflex', border: 'border-reflex/20' },
};

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { workspace, isLoading: wsLoading } = useWorkspace();

    useEffect(() => {
        if (wsLoading) return;
        if (!workspace?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        csrfFetch(`/api/dashboard?workspaceId=${workspace.id}`)
            .then((res) => {
                if (!res.ok) throw new Error(`${res.status}`);
                return res.json();
            })
            .then((d) => {
                setData(d.data || d);
                setLoading(false);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : 'An unexpected error occurred');
                setLoading(false);
            });
    }, [workspace?.id, wsLoading]);

    /* ───── Loading ───── */
    if (loading || wsLoading) {
        return (
            <PageSpinner text="Loading dashboard…" />
        );
    }

    /* ───── No workspace ───── */
    if (!workspace?.id) {
        return (
            <EmptyState
                title="No workspace selected"
                description="Create or select a workspace to view your dashboard."
            />
        );
    }

    /* ───── Error ───── */
    if (error) {
        return (
            <ErrorState
                title="Unable to load dashboard"
                description={error === '401' ? 'Your session has expired. Please sign in again.' : 'Something went wrong. Please try again.'}
                onRetry={() => window.location.reload()}
            />
        );
    }

    /* ───── Dashboard ───── */
    return (
        <>
            {/* Header */}
            <div className="mb-8 animate-fade-in">
                <h1 className="mb-2 text-3xl font-extrabold text-foreground tracking-tight">
                    Operations <span className="text-gradient">Dashboard</span>
                </h1>
                <p className="text-muted-foreground">Welcome to your IT operations center</p>
            </div>

            {/* Stats Grid */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up">
                {statCards.map((card) => {
                    const c = colorMap[card.color];
                    const value = data?.stats?.[card.key as keyof DashboardData['stats']] ?? 0;
                    return (
                        <div
                            key={card.key}
                            className={`group rounded-2xl border ${c.border} bg-card p-6 
                                                transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{card.label}</p>
                                    <p className="mt-1.5 text-3xl font-bold text-foreground">{value}</p>
                                </div>
                                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
                                    {card.icon}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Recent Assets & Active Sessions */}
            <div className="grid gap-6 lg:grid-cols-2 animate-slide-up [animation-delay:0.1s]">
                {/* Recent Assets */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="border-b border-border px-6 py-4">
                        <h2 className="text-sm font-bold text-foreground">Recent Assets</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Latest assets added to the system</p>
                    </div>
                    <div className="p-6">
                        {data && data.recentAssets?.length > 0 ? (
                            <div className="space-y-3">
                                {data.recentAssets.map((asset) => (
                                    <div key={asset.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{asset.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {asset.category} • {asset.assignedTo?.name || 'Unassigned'}
                                            </p>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${asset.status === 'AVAILABLE'
                                            ? 'bg-health-good/10 text-health-good border border-health-good/20'
                                            : 'bg-primary/10 text-primary border border-primary/20'
                                            }`}>
                                            {asset.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-2">
                                <EmptyState
                                    icon={
                                        <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                        </svg>
                                    }
                                    title="No assets yet"
                                    description="Get started by adding infrastructure to your workspace."
                                    action={{ label: 'Add Asset', href: '/assets/new' }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Sessions */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-foreground">Active Remote Sessions</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Currently active remote desktop connections</p>
                        </div>
                        <Link href="/remote" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                            View All →
                        </Link>
                    </div>
                    <div className="p-6">
                        {data && data.activeSessionsList?.length > 0 ? (
                            <div className="space-y-3">
                                {data.activeSessionsList.map((session) => (
                                    <div key={session.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                        <div>
                                            <Link href={`/assets/${session.asset.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                                                {session.asset.name}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">
                                                {session.user?.name || 'Unknown'} • {formatDateTime(session.startedAt || session.lastSeen)}
                                            </p>
                                        </div>
                                        <Link
                                            href={`/remote/${session.id}`}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 transition-all"
                                        >
                                            <span className="h-2 w-2 rounded-full bg-health-good animate-pulse" />
                                            Join
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-2">
                                <EmptyState
                                    icon={
                                        <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    }
                                    title="No active sessions"
                                    description="There are currently no active remote desktop connections."
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 text-center text-xs text-muted-foreground">
                <div className="flex items-center justify-center gap-4">
                    <p>Glanus — AI-Native IT Operations Platform</p>
                    <span className="text-border">·</span>
                    <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                    <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                </div>
            </div>
        </>
    );
}
