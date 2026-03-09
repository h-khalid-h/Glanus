'use client';
import { ErrorState } from '@/components/ui/EmptyState';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MissionControl } from '@/components/workspace/MissionControl';
import { TopologyMap } from '@/components/workspace/TopologyMap';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import type { OperationalGraphData } from '@/lib/nerve/operational-graph';
import { csrfFetch } from '@/lib/api/csrfFetch';

interface AnalyticsData {
    workspaceName: string;
    plan: string;
    reliabilityScore: number;
    activeAgents: number;
    totalAgents: number;
    alertCount: number;
    assetCount: {
        current: number;
        change: number;
        changePercent: number;
    };
    memberCount: {
        current: number;
        change: number;
        changePercent: number;
    };
    aiCreditsUsed: {
        current: number;
        limit: number;
        percentUsed: number;
    };
    storageUsed: {
        current: number;
        limit: number;
        percentUsed: number;
    };
    alerts: {
        info: number;
        warning: number;
        critical: number;
    };
    systemHealth?: {
        avgCpu: number;
        avgRam: number;
        avgDisk: number;
        agentsOnline: number;
        agentsOffline: number;
        agentsError: number;
        totalAgents: number;
    };
    recentActivity: Array<{
        id: string;
        action: string;
        resourceType: string | null;
        resourceId: string | null;
        user: {
            id: string;
            name: string | null;
            email: string;
        } | null;
        asset: {
            id: string;
            name: string | null;
        } | null;
        createdAt: string;
    }>;
}

interface IntelligenceSummary {
    overallStatus: 'nominal' | 'watch' | 'attention';
    totalForecasts: number;
    criticalForecasts: number;
    criticalResources: number;
    sloAtRisk: number;
}

export default function AnalyticsPage() {
    const params = useParams();
    const workspaceId = params.id as string;

    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [topology, setTopology] = useState<OperationalGraphData | null>(null);
    const [intelligence, setIntelligence] = useState<IntelligenceSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [focusNode, setFocusNode] = useState<string | null>(null);
    const [blastRadius, setBlastRadius] = useState<string[]>([]);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // Fetch analytics, topology, and oracle in parallel
                const [analyticsRes, topologyRes, oracleRes] = await Promise.all([
                    csrfFetch(`/api/workspaces/${workspaceId}/analytics`),
                    csrfFetch(`/api/workspaces/${workspaceId}/topology`).catch(() => null),
                    csrfFetch(`/api/workspaces/${workspaceId}/oracle`).catch(() => null),
                ]);

                if (!analyticsRes.ok) throw new Error('Failed to fetch analytics');
                const analyticsResult = await analyticsRes.json();
                setAnalytics(analyticsResult.data || analyticsResult);

                // Topology (non-blocking)
                if (topologyRes?.ok) {
                    const topoResult = await topologyRes.json();
                    setTopology(topoResult.data?.graph || topoResult.data || null);
                }

                // Oracle intelligence (non-blocking)
                if (oracleRes?.ok) {
                    const oracleResult = await oracleRes.json();
                    setIntelligence(oracleResult.data?.summary || null);
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Something went wrong');
            } finally {
                setIsLoading(false);
            }
        };

        if (workspaceId) fetchAll();
    }, [workspaceId]);

    // Handle node selection → blast radius
    const handleNodeSelect = async (nodeId: string) => {
        setFocusNode(nodeId);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/topology?focus=${nodeId}`);
            if (res.ok) {
                const result = await res.json();
                setBlastRadius(result.data?.blastRadius || []);
            }
        } catch {
            // Non-critical, just clear
            setBlastRadius([]);
        }
    };

    if (isLoading) {
        return <SkeletonDashboard />;
    }

    if (error || !analytics) {
        return (
            <div className="card flex flex-col items-center justify-center min-h-[400px]">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                    <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                </div>
                <p className="text-sm font-medium text-destructive mb-1">Unable to load analytics</p>
                <p className="text-xs text-muted-foreground mb-4">{error || 'Something went wrong'}</p>
                <button type="button" onClick={() => window.location.reload()} className="btn-primary text-sm">
                    Try Again
                </button>
            </div>
        );
    }

    // Determine if workspace has enough data for topology
    const showTopology = topology && topology.nodes.length > 0;
    const showIntelligence = intelligence != null;

    return (
        <div className="space-y-6">
            {/* Mission Control */}
            <MissionControl
                data={{
                    assetCount: analytics.assetCount.current,
                    activeUsers: analytics.memberCount.current,
                    activeAgents: analytics.activeAgents,
                    alertCount: analytics.alertCount,
                    reliabilityScore: analytics.reliabilityScore,
                    recentActivity: analytics.recentActivity,
                    systemHealth: analytics.systemHealth,
                }}
                workspaceName={analytics.workspaceName}
                workspaceId={workspaceId}
                plan={analytics.plan}
            />

            {/* Intelligence bar (ORACLE summary) */}
            {showIntelligence && (
                <IntelligenceBar summary={intelligence} workspaceId={workspaceId} />
            )}

            {/* Topology Map */}
            {showTopology && (
                <TopologyMap
                    graph={topology}
                    focusNodeId={focusNode}
                    blastRadius={blastRadius}
                    onNodeSelect={handleNodeSelect}
                />
            )}

            {/* Empty state for topology */}
            {!showTopology && analytics.assetCount.current === 0 && (
                <EmptyWorkspaceGuide workspaceId={workspaceId} />
            )}
        </div>
    );
}

// ─── Intelligence Bar ────────────────────────────────────

function IntelligenceBar({ summary, workspaceId }: { summary: IntelligenceSummary; workspaceId: string }) {
    const statusConfig = {
        nominal: {
            label: 'All Systems Nominal',
            color: 'text-health-good',
            bg: 'bg-health-good/10',
            icon: '✓',
        },
        watch: {
            label: 'Watching',
            color: 'text-oracle',
            bg: 'bg-oracle/10',
            icon: '◉',
        },
        attention: {
            label: 'Attention Required',
            color: 'text-health-critical',
            bg: 'bg-health-critical/10',
            icon: '⚠',
        },
    };

    const config = statusConfig[summary.overallStatus];

    return (
        <div className={`rounded-xl border border-border px-4 py-3 ${config.bg}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className={`text-lg ${config.color}`}>{config.icon}</span>
                    <div>
                        <p className={`text-sm font-semibold ${config.color}`}>
                            ORACLE — {config.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {summary.totalForecasts} forecast{summary.totalForecasts !== 1 ? 's' : ''}
                            {summary.criticalForecasts > 0 && (
                                <span className="text-health-critical"> · {summary.criticalForecasts} critical</span>
                            )}
                            {summary.criticalResources > 0 && (
                                <span className="text-oracle"> · {summary.criticalResources} resource warning{summary.criticalResources !== 1 ? 's' : ''}</span>
                            )}
                            {summary.sloAtRisk > 0 && (
                                <span className="text-oracle"> · {summary.sloAtRisk} SLO at risk</span>
                            )}
                        </p>
                    </div>
                </div>
                <a
                    href={`/workspaces/${workspaceId}/intelligence`}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    View Details →
                </a>
            </div>
        </div>
    );
}

// ─── Empty State Guide ───────────────────────────────────

function EmptyWorkspaceGuide({ workspaceId }: { workspaceId: string }) {
    const steps = [
        {
            step: 1,
            label: 'Install Agent',
            description: 'Deploy the Glanus agent on your first machine',
            href: `/workspaces/${workspaceId}/download-agent`,
            icon: '📡',
            accent: 'bg-nerve/10 text-nerve border-nerve/20',
        },
        {
            step: 2,
            label: 'Add Assets',
            description: 'Register your servers, workstations, and infrastructure',
            href: `/workspaces/${workspaceId}/analytics`,
            icon: '🖥️',
            accent: 'bg-cortex/10 text-cortex border-cortex/20',
        },
        {
            step: 3,
            label: 'Set Up Alerts',
            description: 'Define monitoring rules for your environment',
            href: `/workspaces/${workspaceId}/alerts`,
            icon: '🔔',
            accent: 'bg-oracle/10 text-oracle border-oracle/20',
        },
        {
            step: 4,
            label: 'Create Automations',
            description: 'Let REFLEX handle routine operations',
            href: `/workspaces/${workspaceId}/intelligence`,
            icon: '⚡',
            accent: 'bg-reflex/10 text-reflex border-reflex/20',
        },
    ];

    return (
        <div className="card">
            <div className="mb-5">
                <h2 className="text-lg font-semibold">Get Started</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Complete these steps to unlock the full power of Glanus
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {steps.map(s => (
                    <a
                        key={s.step}
                        href={s.href}
                        className={`flex items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/30 ${s.accent}`}
                    >
                        <span className="text-xl">{s.icon}</span>
                        <div>
                            <p className="text-sm font-semibold">
                                Step {s.step}: {s.label}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
