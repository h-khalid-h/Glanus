'use client';
import { useToast } from '@/lib/toast';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/workspace/context';
import Link from 'next/link';
import { ArrowLeft, Server, Cpu, HardDrive, MemoryStick, Clock, Terminal, CheckCircle, XCircle, Loader2, WifiOff, Box } from 'lucide-react';
import { PageSpinner } from '@/components/ui/Spinner';

interface AgentDetail {
    id: string;
    hostname: string;
    platform: string;
    status: string;
    agentVersion: string;
    isOutdated: boolean;
    ipAddress: string | null;
    lastSeen: string;
    cpuUsage: number | null;
    ramUsage: number | null;
    diskUsage: number | null;
    asset: {
        id: string;
        name: string;
        assetType: string;
        status: string;
        serialNumber: string | null;
        manufacturer: string | null;
        model: string | null;
        location: string | null;
    } | null;
    installedSoftware?: {
        id: string;
        name: string;
        version: string | null;
        publisher: string | null;
        installDate: string | null;
        sizeMB: number | null;
    }[];
}

interface MetricPoint {
    id: string;
    cpuUsage: number | null;
    ramUsage: number | null;
    diskUsage: number | null;
    timestamp: string;
}

interface Execution {
    id: string;
    scriptName: string;
    language: string;
    status: string;
    output: string | null;
    exitCode: number | null;
    createdAt: string;
    completedAt: string | null;
    script: { id: string; name: string; language: string } | null;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
    if (data.length < 2) return <span className="text-xs text-muted-foreground">No data</span>;

    const max = Math.max(...data, 1);
    const width = 160;
    const height = 40;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (v / max) * (height - 4);
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="inline-block">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                points={points}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function AgentDetailPage() {
    const { error: showError } = useToast();
    const params = useParams();
    const _router = useRouter();
    const { workspace } = useWorkspace();
    const workspaceId = workspace?.id ?? '';
    const agentId = params?.agentId as string;

    const [agent, setAgent] = useState<AgentDetail | null>(null);
    const [metricHistory, setMetricHistory] = useState<MetricPoint[]>([]);
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (workspaceId && agentId) fetchAgentDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId, agentId]);

    const fetchAgentDetail = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/agents/${agentId}`);
            if (!res.ok) throw new Error('Agent not found');
            const data = await res.json();
            setAgent(data.data?.agent || null);
            setMetricHistory(data.data?.metricHistory || []);
            setExecutions(data.data?.recentExecutions || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load agent');
            showError('Load Error', 'Could not load agent details.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SUCCESS': return <CheckCircle size={14} className="text-success" />;
            case 'FAILED': return <XCircle size={14} className="text-destructive" />;
            case 'RUNNING': return <Loader2 size={14} className="text-cortex animate-spin" />;
            case 'PENDING': return <Clock size={14} className="text-warning" />;
            default: return <Clock size={14} className="text-muted-foreground" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'text-success';
            case 'FAILED': return 'text-destructive';
            case 'RUNNING': return 'text-cortex';
            case 'PENDING': return 'text-warning';
            default: return 'text-muted-foreground';
        }
    };

    const getMetricBarColor = (value: number) => {
        if (value >= 90) return 'bg-destructive';
        if (value >= 70) return 'bg-amber-500';
        return 'bg-success';
    };

    if (loading) return <PageSpinner />;
    if (error || !agent) return <ErrorState title="Agent Not Found" description={error || 'This agent does not exist.'} onRetry={() => { setError(null); setLoading(true); fetchAgentDetail(); }} />;

    const cpuData = metricHistory.map(m => m.cpuUsage ?? 0);
    const ramData = metricHistory.map(m => m.ramUsage ?? 0);
    const diskData = metricHistory.map(m => m.diskUsage ?? 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/workspaces/agents`}
                        className="p-2 rounded-xl hover:bg-muted transition text-muted-foreground"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-foreground">{agent.hostname}</h1>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${agent.status === 'ONLINE' ? 'bg-success/10 text-success' :
                                agent.status === 'ERROR' ? 'bg-destructive/10 text-destructive' :
                                    'bg-muted/30 text-muted-foreground'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'ONLINE' ? 'bg-success' :
                                    agent.status === 'ERROR' ? 'bg-destructive' :
                                        'bg-muted-foreground'
                                    }`} />
                                {agent.status}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {agent.platform} • v{agent.agentVersion} • {agent.ipAddress || 'No IP'}
                        </p>
                    </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                    <div>Last seen: {new Date(agent.lastSeen).toLocaleString()}</div>
                    {agent.isOutdated && (
                        <div className="text-warning text-xs mt-1">⚠ Agent version outdated</div>
                    )}
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'CPU Usage', value: agent.cpuUsage, icon: Cpu, data: cpuData, color: '#3b82f6' },
                    { label: 'RAM Usage', value: agent.ramUsage, icon: MemoryStick, data: ramData, color: '#8b5cf6' },
                    { label: 'Disk Usage', value: agent.diskUsage, icon: HardDrive, data: diskData, color: '#f59e0b' },
                ].map(metric => (
                    <div key={metric.label} className="rounded-xl border border-border bg-card p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <metric.icon size={16} />
                                {metric.label}
                            </div>
                            <span className={`text-2xl font-bold ${metric.value !== null && metric.value >= 90 ? 'text-destructive' : metric.value !== null && metric.value >= 70 ? 'text-warning' : 'text-foreground'}`}>
                                {metric.value !== null ? `${metric.value.toFixed(1)}%` : '—'}
                            </span>
                        </div>
                        <div className="mb-3">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${metric.value !== null ? getMetricBarColor(metric.value) : 'bg-muted'}`} style={{ width: `${metric.value ?? 0}%` }} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">24h Trend</span>
                            <MiniSparkline data={metric.data} color={metric.color} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Asset Info */}
            {agent.asset && (
                <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                        <Server size={16} />
                        Linked Asset
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground mb-1">Name</div>
                            <div className="text-foreground font-medium">{agent.asset.name}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground mb-1">Type</div>
                            <div className="text-foreground">{agent.asset.assetType}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground mb-1">Serial</div>
                            <div className="text-foreground font-mono text-xs">{agent.asset.serialNumber || '—'}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground mb-1">Location</div>
                            <div className="text-foreground">{agent.asset.location || '—'}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Offline Notice */}
            {agent.status === 'OFFLINE' && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-center gap-4">
                    <WifiOff className="text-warning flex-shrink-0" size={24} />
                    <div>
                        <h4 className="font-medium text-warning">Agent Offline</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">This agent has not sent a heartbeat recently. Remote operations are unavailable until it reconnects.</p>
                    </div>
                </div>
            )}

            {/* Installed Software */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                    <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Box size={16} className="text-health-good" />
                        Installed Software
                    </h3>
                    <span className="text-xs text-muted-foreground">{agent.installedSoftware?.length || 0} applications</span>
                </div>

                {!agent.installedSoftware || agent.installedSoftware.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Box className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No software inventory reported by agent.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full relative">
                            <thead className="sticky top-0 bg-surface-1/90 backdrop-blur-sm z-10">
                                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                                    <th className="px-6 py-3">Application</th>
                                    <th className="px-6 py-3">Publisher</th>
                                    <th className="px-6 py-3">Version</th>
                                    <th className="px-6 py-3 text-right">Size</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {agent.installedSoftware.map(sw => (
                                    <tr key={sw.id} className="hover:bg-muted/30 transition">
                                        <td className="px-6 py-3 text-sm font-medium text-foreground">{sw.name}</td>
                                        <td className="px-6 py-3 text-sm text-muted-foreground">{sw.publisher || '—'}</td>
                                        <td className="px-6 py-3">
                                            <span className="text-xs px-2 py-0.5 rounded bg-background border border-border text-foreground font-mono inline-block max-w-[120px] truncate">
                                                {sw.version || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right text-xs text-muted-foreground">
                                            {sw.sizeMB ? `${Math.round(sw.sizeMB)} MB` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Script Execution History */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                    <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Terminal size={16} className="text-primary" />
                        Script Execution History
                    </h3>
                    <span className="text-xs text-muted-foreground">{executions.length} records</span>
                </div>

                {executions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No scripts have been executed on this agent.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Script</th>
                                    <th className="px-6 py-3">Language</th>
                                    <th className="px-6 py-3">Exit Code</th>
                                    <th className="px-6 py-3">Started</th>
                                    <th className="px-6 py-3">Completed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {executions.map(exec => (
                                    <tr key={exec.id} className="hover:bg-muted/30 transition">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(exec.status)}
                                                <span className={`text-sm font-medium ${getStatusColor(exec.status)}`}>{exec.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-sm text-foreground">{exec.script?.name || exec.scriptName}</td>
                                        <td className="px-6 py-3">
                                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground uppercase font-mono">{exec.language}</span>
                                        </td>
                                        <td className="px-6 py-3 text-sm font-mono text-muted-foreground">{exec.exitCode !== null ? exec.exitCode : '—'}</td>
                                        <td className="px-6 py-3 text-xs text-muted-foreground">{new Date(exec.createdAt).toLocaleString()}</td>
                                        <td className="px-6 py-3 text-xs text-muted-foreground">{exec.completedAt ? new Date(exec.completedAt).toLocaleString() : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
