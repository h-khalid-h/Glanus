'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/utils';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

interface Insight {
    id: string;
    type: string;
    title: string;
    description: string;
    severity: string | null;
    confidence: number | null;
    acknowledged: boolean;
    createdAt: string;
    asset: {
        id: string;
        name: string;
        status: string;
    } | null;
}

interface InsightSummary {
    total: number;
    unacknowledged: number;
    severity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
    workspaceCount: number;
}

const severityColors: Record<string, string> = {
    critical: 'text-health-critical bg-health-critical/10 border-health-critical/20',
    high: 'text-health-warn bg-health-warn/10 border-health-warn/20',
    medium: 'text-health-warn/80 bg-health-warn/10 border-health-warn/20',
    low: 'text-nerve bg-nerve/10 border-nerve/20',
    info: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

const severityDotColors: Record<string, string> = {
    critical: 'bg-health-critical',
    high: 'bg-health-warn',
    medium: 'bg-health-warn/80',
    low: 'bg-nerve',
    info: 'bg-slate-400',
};

export default function InsightsPage() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [summary, setSummary] = useState<InsightSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchInsights();
    }, []);

    const fetchInsights = async () => {
        try {
            const res = await csrfFetch('/api/dashboard/insights');
            const data = await res.json();
            if (data.success) {
                setInsights(data.data.insights);
                setSummary(data.data.summary);
            }
        } catch (err) {
            console.error('[Insights] Failed to fetch:', err);
            setError(err instanceof Error ? err.message : 'Failed to load insights');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <PageSpinner text="Loading insights…" />;
    if (error) return <ErrorState title="Failed to load insights" description={error} onRetry={() => window.location.reload()} />;

    return (
        <>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Insights</h1>
                <p className="mt-1 text-sm text-slate-400">
                    AI-generated insights across your workspaces
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-nerve" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    {summary && (
                        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                                <p className="text-xs font-medium text-slate-400">Total Insights</p>
                                <p className="mt-1 text-2xl font-bold text-white">{summary.total}</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                                <p className="text-xs font-medium text-slate-400">Pending Review</p>
                                <p className="mt-1 text-2xl font-bold text-nerve">{summary.unacknowledged}</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                                <p className="text-xs font-medium text-slate-400">Critical / High</p>
                                <p className="mt-1 text-2xl font-bold text-health-critical">
                                    {summary.severity.critical + summary.severity.high}
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                                <p className="text-xs font-medium text-slate-400">Workspaces</p>
                                <p className="mt-1 text-2xl font-bold text-white">{summary.workspaceCount}</p>
                            </div>
                        </div>
                    )}

                    {/* Severity Breakdown */}
                    {summary && summary.total > 0 && (
                        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                            <h2 className="mb-4 text-sm font-semibold text-white">Severity Distribution</h2>
                            <div className="flex gap-6">
                                {Object.entries(summary.severity).map(([severity, count]) => (
                                    <div key={severity} className="flex items-center gap-2">
                                        <span className={`h-2.5 w-2.5 rounded-full ${severityDotColors[severity] || 'bg-slate-500'}`} />
                                        <span className="text-xs text-slate-400 capitalize">{severity}</span>
                                        <span className="text-xs font-semibold text-white">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Insights List */}
                    {insights.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 py-16">
                            <svg className="mb-4 h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            <p className="text-sm font-medium text-slate-300">No insights yet</p>
                            <p className="mt-1 text-xs text-slate-500">
                                AI insights will appear here as your agents report data and intelligence engines process it.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {insights.map((insight) => {
                                const severity = (insight.severity || 'info').toLowerCase();
                                return (
                                    <div
                                        key={insight.id}
                                        className={`rounded-xl border p-4 transition-colors ${severityColors[severity] || severityColors.info
                                            } ${insight.acknowledged ? 'opacity-60' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="mb-1 flex items-center gap-2">
                                                    <span className={`h-2 w-2 rounded-full ${severityDotColors[severity] || 'bg-slate-400'}`} />
                                                    <span className="text-xs font-medium uppercase tracking-wider opacity-70">
                                                        {insight.type}
                                                    </span>
                                                    {insight.confidence != null && (
                                                        <span className="text-xs opacity-50">
                                                            {Math.round(insight.confidence * 100)}% confidence
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-sm font-semibold text-white">{insight.title}</h3>
                                                <p className="mt-1 text-xs leading-relaxed opacity-70">{insight.description}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500">{formatDateTime(insight.createdAt)}</p>
                                                {insight.asset && (
                                                    <p className="mt-1 text-xs text-slate-500">{insight.asset.name}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </>
    );
}
