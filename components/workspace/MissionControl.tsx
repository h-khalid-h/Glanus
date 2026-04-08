'use client';

import { useRouter } from 'next/navigation';
import { ReliabilityScore } from '@/components/analytics/ReliabilityScore';
import { NarrativeFeed } from '@/components/workspace/NarrativeFeed';

interface SystemHealth {
    avgCpu: number;
    avgRam: number;
    avgDisk: number;
    agentsOnline: number;
    agentsOffline: number;
    agentsError: number;
    totalAgents: number;
}

interface MissionControlProps {
    data: {
        assetCount: number;
        activeUsers: number;
        activeAgents: number;
        alertCount?: number;
        reliabilityScore?: number;
        previousReliabilityScore?: number;
        systemHealth?: SystemHealth;
        recentActivity: Array<{
            id: string;
            action: string;
            resourceType?: string | null;
            resourceId?: string | null;
            createdAt: string;
            user?: { name?: string | null; email?: string | null } | null;
            asset?: { name?: string | null } | null;
            metadata?: Record<string, unknown> | null;
        }>;
    };
    workspaceName: string;
    workspaceId?: string;
    plan?: string;
}

export function MissionControl({ data, workspaceName, workspaceId, plan }: MissionControlProps) {
    const router = useRouter();
    const {
        assetCount,
        activeUsers,
        activeAgents,
        alertCount = 0,
        reliabilityScore = 92,
        previousReliabilityScore,
        systemHealth,
        recentActivity,
    } = data;

    // Adaptive layout based on workspace complexity
    const isSmall = assetCount <= 10 && activeUsers <= 3;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {workspaceName}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Mission Control • {new Date().toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Export Report Action */}
                    <button
                        type="button"
                        onClick={() => {
                            if (workspaceId) {
                                window.location.href = `/api/workspaces/${workspaceId}/reports?type=asset_inventory&format=csv`;
                            }
                        }}
                        className="hidden sm:flex items-center gap-2 rounded-lg bg-nerve/10 hover:bg-nerve/20 transition-colors border border-nerve/20 px-3 py-1.5 text-xs font-semibold text-nerve"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Export Report (CSV)
                    </button>

                    {/* Cmd+K hint */}
                    <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground">
                        <kbd className="command-kbd">⌘</kbd>
                        <kbd className="command-kbd">K</kbd>
                        <span>Quick Actions</span>
                    </div>
                </div>
            </div>

            {/* Top section: Reliability + Metrics */}
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                {/* Reliability gauge */}
                <div className="card flex flex-col items-center justify-center py-6">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Reliability Score
                    </p>
                    <ReliabilityScore
                        score={reliabilityScore}
                        previousScore={previousReliabilityScore}
                        size="md"
                    />
                </div>

                {/* Metric cards grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                        label="Assets"
                        value={assetCount}
                        icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 0 0-.12-1.03l-2.268-9.64a3.375 3.375 0 0 0-3.285-2.602H7.923a3.375 3.375 0 0 0-3.285 2.602l-2.268 9.64a4.5 4.5 0 0 0-.12 1.03v.228m19.5 0a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3m19.5 0a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3m16.5 0h.008v.008h-.008v-.008Zm-3 0h.008v.008h-.008v-.008Z" />
                            </svg>
                        }
                        accentClass="text-nerve bg-nerve/10"
                    />
                    <MetricCard
                        label="Agents Online"
                        value={activeAgents}
                        icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
                            </svg>
                        }
                        accentClass="text-reflex bg-reflex/10"
                        status={activeAgents > 0 ? 'online' : undefined}
                    />
                    <MetricCard
                        label="Team Members"
                        value={activeUsers}
                        icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                            </svg>
                        }
                        accentClass="text-cortex bg-cortex/10"
                    />
                    <MetricCard
                        label="Active Alerts"
                        value={alertCount}
                        icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                            </svg>
                        }
                        accentClass={alertCount > 0 ? 'text-oracle bg-oracle/10' : 'text-health-good bg-health-good/10'}
                        status={alertCount > 0 ? 'warning' : undefined}
                    />
                </div>
            </div>

            {/* System Health Widget */}
            {systemHealth && systemHealth.totalAgents > 0 && (
                <SystemHealthWidget health={systemHealth} />
            )}

            {/* Bottom section: Activity feed + Quick actions */}
            <div className={`grid gap-5 ${isSmall ? '' : 'lg:grid-cols-[1fr_320px]'}`}>
                {/* Activity Feed */}
                <div className="card">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-semibold">Recent Activity</h2>
                        <span className="text-xs text-muted-foreground">
                            {recentActivity.length} events
                        </span>
                    </div>
                    <NarrativeFeed activities={recentActivity} maxItems={isSmall ? 5 : 8} />
                </div>

                {/* Quick actions / System status (hidden for small workspaces) */}
                {!isSmall && (
                    <div className="space-y-5">
                        {/* Quick Actions */}
                        <div className="card">
                            <h2 className="mb-3 text-sm font-semibold">Quick Actions</h2>
                            <div className="space-y-1.5">
                                <QuickAction
                                    label="Add Asset"
                                    icon="＋"
                                    accentClass="bg-nerve/10 text-nerve"
                                    onClick={() => router.push('/assets/new')}
                                />
                                <QuickAction
                                    label="Invite Member"
                                    icon="↗"
                                    accentClass="bg-cortex/10 text-cortex"
                                    onClick={() => router.push(`/workspaces/manage/members`)}
                                />
                                <QuickAction
                                    label="Create Alert Rule"
                                    icon="⚡"
                                    accentClass="bg-oracle/10 text-oracle"
                                    onClick={() => router.push(`/workspaces/alerts`)}
                                />
                                <QuickAction
                                    label="Run Script"
                                    icon="▶"
                                    accentClass="bg-reflex/10 text-reflex"
                                    onClick={() => router.push(`/workspaces/agents`)}
                                />
                            </div>
                        </div>

                        {/* Plan info */}
                        {plan && (
                            <div className="card bg-gradient-primary">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground">Current Plan</p>
                                        <p className="mt-0.5 text-sm font-semibold capitalize">{plan}</p>
                                    </div>
                                    <span className="badge-primary">{plan}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ===== Sub-components ===== */

function MetricCard({
    label,
    value,
    icon,
    accentClass,
    status,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    accentClass: string;
    status?: 'online' | 'warning';
}) {
    return (
        <div className="metric-card">
            <div className="flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentClass}`}>
                    {icon}
                </div>
                {status === 'online' && <span className="status-online" />}
                {status === 'warning' && <span className="status-warning" />}
            </div>
            <div className="mt-3">
                <p className="text-2xl font-bold tabular-nums">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}

function QuickAction({
    label,
    icon,
    accentClass,
    onClick,
}: {
    label: string;
    icon: string;
    accentClass: string;
    onClick?: () => void;
}) {
    return (
        <button type="button"
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium 
                       text-foreground transition-colors hover:bg-accent/50"
        >
            <span className={`flex h-7 w-7 items-center justify-center rounded-md text-xs ${accentClass}`}>
                {icon}
            </span>
            {label}
        </button>
    );
}

/* ===== System Health Widget ===== */

function HealthMeter({ label, value, icon, color }: {
    label: string;
    value: number;
    icon: string;
    color: 'nerve' | 'cortex' | 'reflex';
}) {
    const colorMap = {
        nerve: { bg: 'bg-nerve', text: 'text-nerve' },
        cortex: { bg: 'bg-cortex', text: 'text-cortex' },
        reflex: { bg: 'bg-reflex', text: 'text-reflex' },
    };
    const barColor = value > 85 ? 'bg-red-500' : value > 65 ? 'bg-amber-500' : colorMap[color].bg;
    const textColor = value > 85 ? 'text-red-400' : value > 65 ? 'text-amber-400' : colorMap[color].text;

    return (
        <div className="flex-1 min-w-[120px]">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <span>{icon}</span> {label}
                </span>
                <span className={`text-sm font-bold tabular-nums ${textColor}`}>{value}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
        </div>
    );
}

function SystemHealthWidget({ health }: { health: SystemHealth }) {
    return (
        <div className="card">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <svg className="h-4 w-4 text-nerve" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                    System Health Pulse
                </h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {health.agentsOnline} online
                    </span>
                    {health.agentsOffline > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-slate-500" />
                            {health.agentsOffline} offline
                        </span>
                    )}
                    {health.agentsError > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            {health.agentsError} error
                        </span>
                    )}
                </div>
            </div>
            <div className="flex gap-6 flex-wrap">
                <HealthMeter label="CPU Avg" value={health.avgCpu} icon="⚙" color="nerve" />
                <HealthMeter label="RAM Avg" value={health.avgRam} icon="◫" color="cortex" />
                <HealthMeter label="Disk Avg" value={health.avgDisk} icon="◉" color="reflex" />
            </div>
        </div>
    );
}
