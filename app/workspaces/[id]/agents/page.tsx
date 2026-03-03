'use client';
import { useToast } from '@/lib/toast';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Server, Monitor } from 'lucide-react';
import { PageSpinner } from '@/components/ui/Spinner';

interface Agent {
    id: string;
    status: string;
    platform: string;
    hostname: string;
    agentVersion: string;
    ipAddress: string | null;
    lastSeen: string;
    cpuUsage: number | null;
    ramUsage: number | null;
    diskUsage: number | null;
    asset: {
        id: string;
        name: string;
        model: string | null;
        serialNumber: string | null;
    };
}

interface Stats {
    total: number;
    online: number;
    offline: number;
    error: number;
}

export default function WorkspaceAgentsPage() {
    const { error: showError } = useToast();
    const params = useParams();
    const router = useRouter();
    const workspaceId = params?.id as string;

    const [agents, setAgents] = useState<Agent[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, online: 0, offline: 0, error: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectingAgentId, setConnectingAgentId] = useState<string | null>(null);

    useEffect(() => {
        if (workspaceId) {
            fetchAgents();
        }
    }, [workspaceId]);

    const fetchAgents = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/agents`);
            const data = await res.json();

            if (res.ok) {
                const responseData = data.data || {};
                setAgents(responseData.agents || []);
                setStats(responseData.stats || { total: 0, online: 0, offline: 0, error: 0 });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
            showError('Failed to load agents:', msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ONLINE': return 'bg-health-good/15 text-health-good';
            case 'OFFLINE': return 'bg-slate-800/50 text-slate-200';
            case 'ERROR': return 'bg-health-critical/15 text-health-critical';
            case 'UPDATING': return 'bg-nerve/10 text-nerve';
            default: return 'bg-slate-800/50 text-slate-200';
        }
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'WINDOWS': return '🪟';
            case 'MACOS': return '🍎';
            case 'LINUX': return '🐧';
            default: return '💻';
        }
    };

    const getTimeSince = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    if (loading) {
        return (
            <PageSpinner />
        );
    }

    if (error) {
        return <ErrorState title="Failed to load agents" description={error} onRetry={() => { setError(null); setLoading(true); fetchAgents(); }} />;
    }

    return (
        <>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Agent Monitoring</h1>
                <p className="text-slate-400">Monitor all installed Glanus agents in this workspace</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                    <p className="text-sm text-slate-400 mb-1">Total Agents</p>
                    <p className="text-3xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                    <p className="text-sm text-slate-400 mb-1">Online</p>
                    <p className="text-3xl font-bold text-health-good">{stats.online}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                    <p className="text-sm text-slate-400 mb-1">Offline</p>
                    <p className="text-3xl font-bold text-slate-400">{stats.offline}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                    <p className="text-sm text-slate-400 mb-1">Issues</p>
                    <p className="text-3xl font-bold text-health-critical">{stats.error}</p>
                </div>
            </div>

            {/* Agents Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                    <h2 className="text-xl font-semibold">Connected Agents</h2>
                </div>

                {agents.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/10 m-6">
                        <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                            <Server className="w-6 h-6 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">No Agents Installed</h3>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                            Install the Glanus agent on your assets to enable remote monitoring and management.
                        </p>
                        <Link
                            href={`/workspaces/${workspaceId}/download-agent`}
                            className="inline-block px-6 py-2 bg-nerve text-white text-sm rounded-md font-semibold hover:brightness-110 transition"
                        >
                            Download Agent
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-900/30">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Asset</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Platform</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Metrics</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Last Seen</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {agents.map((agent) => (
                                    <tr key={agent.id} className="hover:bg-slate-900/30">
                                        <td className="px-6 py-4">
                                            <div>
                                                <Link
                                                    href={`/assets/${agent.asset.id}`}
                                                    className="font-medium text-nerve hover:underline"
                                                >
                                                    {agent.asset.name}
                                                </Link>
                                                <p className="text-sm text-slate-400">{agent.hostname}</p>
                                                {agent.asset.serialNumber && (
                                                    <p className="text-xs text-slate-500">SN: {agent.asset.serialNumber}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-2xl">{getPlatformIcon(agent.platform)}</span>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{agent.platform}</p>
                                                    <p className="text-xs text-slate-500">v{agent.agentVersion}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(agent.status)}`}>
                                                {agent.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {agent.status === 'ONLINE' && agent.cpuUsage !== null ? (
                                                <div className="text-sm space-y-1">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-slate-400">CPU:</span>
                                                        <span className="font-medium">{agent.cpuUsage.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-slate-400">RAM:</span>
                                                        <span className="font-medium">{agent.ramUsage?.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-slate-400">Disk:</span>
                                                        <span className="font-medium">{agent.diskUsage?.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-slate-500">No data</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-400">{getTimeSince(agent.lastSeen)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {agent.status === 'ONLINE' && (
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                setConnectingAgentId(agent.id);
                                                                const res = await csrfFetch('/api/remote/sessions', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ assetId: agent.asset.id }),
                                                                });
                                                                if (!res.ok) {
                                                                    const data = await res.json();
                                                                    throw new Error(data.error || 'Failed to connect');
                                                                }
                                                                const session = await res.json();
                                                                const sessionId = session.data?.id || session.id;
                                                                router.push(`/remote/${sessionId}`);
                                                            } catch (err: unknown) {
                                                                showError('Connection Failed', err instanceof Error ? err.message : 'Could not start remote session');
                                                            } finally {
                                                                setConnectingAgentId(null);
                                                            }
                                                        }}
                                                        disabled={connectingAgentId === agent.id}
                                                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-nerve text-white rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
                                                    >
                                                        <Monitor size={14} />
                                                        {connectingAgentId === agent.id ? 'Connecting…' : 'Connect'}
                                                    </button>
                                                )}
                                                <Link
                                                    href={`/assets/${agent.asset.id}/agent`}
                                                    className="text-sm text-nerve hover:underline"
                                                >
                                                    View Details
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info Box */}
            {agents.length > 0 && (
                <div className="mt-8 bg-nerve/5 border border-nerve/20 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-nerve mb-2">About Glanus Agent</h3>
                    <ul className="list-disc list-inside space-y-1 text-nerve text-sm">
                        <li>Agents check in every 60 seconds with latest metrics</li>
                        <li>Metrics are collected every 5 minutes and stored for 30 days</li>
                        <li>Agents marked offline if no check-in for 10 minutes</li>
                        <li>Remote scripts execute within 60 seconds of queueing</li>
                        <li>Agents auto-update in the background (no restart required)</li>
                    </ul>
                </div>
            )}
        </>
    );
}
