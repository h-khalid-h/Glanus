'use client';

import { useEffect, useState } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { formatDateTime } from '@/lib/utils';
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
    const { workspace } = useWorkspace();

    useEffect(() => {
        if (!workspace?.id) return;

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
    }, [workspace?.id]);

    /* ───── Loading ───── */
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-midnight relative overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-20" />
                <div className="relative z-10 flex min-h-screen items-center justify-center">
                    <div className="text-center animate-fade-in">
                        <svg width="48" height="48" viewBox="0 0 32 32" fill="none" className="mx-auto mb-4 animate-glow">
                            <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                                stroke="hsl(168, 100%, 45%)" strokeWidth="2" strokeLinecap="round" />
                            <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                                stroke="hsl(168, 100%, 45%)" strokeWidth="2" strokeLinecap="round" />
                            <circle cx="16" cy="16" r="2" fill="hsl(168, 100%, 45%)" opacity="0.6" />
                        </svg>
                        <p className="text-slate-400 text-sm">Loading dashboard…</p>
                    </div>
                </div>
            </div>
        );
    }

    /* ───── Error ───── */
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-midnight relative overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-20" />
                <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
                    <div className="max-w-md text-center animate-fade-in">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-health-critical/10 border border-health-critical/20">
                            <svg className="h-7 w-7 text-health-critical" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-white">Unable to load dashboard</h2>
                        <p className="mb-6 text-sm text-slate-400">
                            {error === '401' ? 'Your session has expired. Please sign in again.' : 'Something went wrong. Please try again.'}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="inline-flex items-center gap-2 rounded-xl bg-nerve px-6 py-2.5 text-sm font-medium text-white
                                           transition-all hover:brightness-110 hover:shadow-lg hover:shadow-nerve/20"
                            >
                                Try Again
                            </button>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-6 py-2.5 text-sm font-medium text-slate-300
                                           transition-all hover:border-slate-500 hover:text-white"
                            >
                                Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ───── Dashboard ───── */
    return (
        <div className="min-h-screen bg-gradient-midnight relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-15" />

            {/* Ambient glows */}
            <div className="absolute top-0 right-1/3 w-72 h-72 rounded-full opacity-6 blur-3xl bg-nerve" />
            <div className="absolute bottom-1/4 left-1/4 w-56 h-56 rounded-full opacity-5 blur-3xl bg-violet-500" />

            <div className="relative z-10 p-6 md:p-8">
                <div className="mx-auto max-w-7xl">
                    <DashboardNav />

                    {/* Header */}
                    <div className="mb-8 animate-fade-in">
                        <h1 className="mb-2 text-3xl font-bold text-white">
                            Operations <span className="text-gradient">Dashboard</span>
                        </h1>
                        <p className="text-slate-400">Welcome to your IT operations center</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up">
                        {statCards.map((card) => {
                            const c = colorMap[card.color];
                            const value = data?.stats?.[card.key as keyof DashboardData['stats']] ?? 0;
                            return (
                                <div
                                    key={card.key}
                                    className={`group rounded-xl border ${c.border} bg-slate-900/50 backdrop-blur-sm p-5 
                                                transition-all duration-300 hover:bg-slate-900/70`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-400">{card.label}</p>
                                            <p className="mt-1 text-3xl font-bold text-white">{value}</p>
                                        </div>
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
                                            {card.icon}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Recent Assets & Active Sessions */}
                    <div className="grid gap-6 lg:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        {/* Recent Assets */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                            <div className="border-b border-slate-800 px-5 py-4">
                                <h2 className="text-sm font-semibold text-white">Recent Assets</h2>
                                <p className="text-xs text-slate-500">Latest assets added to the system</p>
                            </div>
                            <div className="p-5">
                                {data && data.recentAssets?.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.recentAssets.map((asset) => (
                                            <div key={asset.id} className="flex items-center justify-between border-b border-slate-800/50 pb-3 last:border-0 last:pb-0">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-200">{asset.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {asset.category} • {asset.assignedTo?.name || 'Unassigned'}
                                                    </p>
                                                </div>
                                                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${asset.status === 'AVAILABLE'
                                                    ? 'bg-health-good/10 text-health-good border border-health-good/20'
                                                    : 'bg-nerve/10 text-nerve border border-nerve/20'
                                                    }`}>
                                                    {asset.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="py-6 text-center text-sm text-slate-500">No assets yet</p>
                                )}
                            </div>
                        </div>

                        {/* Active Sessions */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                            <div className="border-b border-slate-800 px-5 py-4">
                                <h2 className="text-sm font-semibold text-white">Active Remote Sessions</h2>
                                <p className="text-xs text-slate-500">Currently active remote desktop connections</p>
                            </div>
                            <div className="p-5">
                                {data && data.activeSessionsList.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.activeSessionsList.map((session) => (
                                            <div key={session.id} className="flex items-center justify-between border-b border-slate-800/50 pb-3 last:border-0 last:pb-0">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-200">{session.asset.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {session.user?.name || 'Unknown'} • {formatDateTime(session.startedAt || session.lastSeen)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full bg-health-good animate-pulse" />
                                                    <span className="text-xs font-medium text-health-good">Active</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="py-6 text-center text-sm text-slate-500">No active sessions</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-10 text-center text-xs text-slate-600">
                        <div className="flex items-center justify-center gap-4">
                            <p>Glanus — AI-Native IT Operations Platform</p>
                            <span className="text-slate-800">·</span>
                            <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
                            <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
