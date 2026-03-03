'use client';
import { formatDate, formatDateTime } from '@/lib/utils';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageSpinner } from '@/components/ui/Spinner';
import MetricsChart from '@/components/agent/MetricsChart';
import { useToast } from '@/lib/toast';

interface Agent {
    id: string;
    status: string;
    platform: string;
    hostname: string;
    agentVersion: string;
    ipAddress: string | null;
    macAddress: string | null;
    lastSeen: string;
    cpuUsage: number | null;
    ramUsage: number | null;
    diskUsage: number | null;
    networkUp: number | null;
    networkDown: number | null;
}

interface ScriptExecution {
    id: string;
    scriptName: string;
    language: string;
    status: string;
    exitCode: number | null;
    output: string | null;
    error: string | null;
    createdAt: string;
    completedAt: string | null;
}

interface MetricDataPoint {
    timestamp: string;
    cpuUsage: number;
    ramUsage: number;
    diskUsage: number;
    networkUp: number;
    networkDown: number;
}

const statusBadge: Record<string, string> = {
    COMPLETED: 'bg-health-good/10 text-health-good border-health-good/20',
    RUNNING: 'bg-nerve/10 text-nerve border-nerve/20',
    PENDING: 'bg-oracle/10 text-oracle border-oracle/20',
    FAILED: 'bg-health-critical/10 text-health-critical border-health-critical/20',
    TIMEOUT: 'bg-health-warn/10 text-health-warn border-health-warn/20',
};

const agentStatusBadge: Record<string, string> = {
    ONLINE: 'bg-health-good/10 text-health-good border-health-good/20',
    OFFLINE: 'bg-slate-700/50 text-slate-400 border-slate-600/30',
    ERROR: 'bg-health-critical/10 text-health-critical border-health-critical/20',
};

export default function AssetAgentPage() {
    const params = useParams();
    const assetId = params?.id as string;

    const { error: showError, success: showSuccess } = useToast();
    const [agent, setAgent] = useState<Agent | null>(null);
    const [executions, setExecutions] = useState<ScriptExecution[]>([]);
    const [metrics, setMetrics] = useState<MetricDataPoint[]>([]);
    const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
    const [loading, setLoading] = useState(true);
    const [loadingMetrics, setLoadingMetrics] = useState(false);

    const [scriptName, setScriptName] = useState('');
    const [scriptBody, setScriptBody] = useState('');
    const [language, setLanguage] = useState<'powershell' | 'bash' | 'python'>('powershell');
    const [executing, setExecuting] = useState(false);

    useEffect(() => {
        if (assetId) {
            fetchAgentData();
            fetchExecutions();
            fetchMetrics();
            const interval = setInterval(() => {
                fetchAgentData();
                fetchExecutions();
            }, 10000);
            return () => clearInterval(interval);
        }
    }, [assetId]);

    useEffect(() => {
        if (assetId) fetchMetrics();
    }, [timeRange, assetId]);

    const fetchAgentData = async () => {
        try {
            const res = await csrfFetch(`/api/assets/${assetId}/agent`);
            if (res.ok) setAgent(await res.json());
        } catch (err: unknown) {
            showError('Failed to load agent', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const fetchExecutions = async () => {
        try {
            const res = await csrfFetch(`/api/assets/${assetId}/execute-script`);
            if (res.ok) {
                const data = await res.json();
                setExecutions(data.executions);
            }
        } catch (err: unknown) {
            showError('Failed to load executions', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const fetchMetrics = async () => {
        setLoadingMetrics(true);
        try {
            const res = await csrfFetch(`/api/assets/${assetId}/metrics?timeRange=${timeRange}`);
            if (res.ok) setMetrics((await res.json()).metrics);
        } catch (err: unknown) {
            showError('Failed to load metrics', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoadingMetrics(false);
        }
    };

    const executeScript = async (e: React.FormEvent) => {
        e.preventDefault();
        setExecuting(true);
        try {
            const res = await csrfFetch(`/api/assets/${assetId}/execute-script`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scriptName, scriptBody, language }),
            });
            const data = await res.json();
            if (res.ok) {
                showSuccess('Script Queued', `Execution ID: ${data.executionId}`);
                setScriptName('');
                setScriptBody('');
                fetchExecutions();
            } else {
                showError('Error', data.error);
            }
        } catch (err: unknown) {
            showError('Script Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setExecuting(false);
        }
    };

    /* ───── Loading ───── */
    if (loading) {
        return <PageSpinner text="Loading agent data…" />;
    }

    /* ───── No Agent ───── */
    if (!agent) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="max-w-md text-center animate-fade-in">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-nerve/10 border border-nerve/20">
                        <svg className="h-8 w-8 text-nerve" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">No Agent Installed</h2>
                    <p className="text-sm text-slate-400 mb-6">
                        Install the Glanus agent on this asset to enable remote monitoring and management
                    </p>
                    <Link
                        href="/download-agent"
                        className="inline-flex items-center gap-2 rounded-xl bg-nerve px-6 py-2.5 text-sm font-medium text-white
                                   transition-all hover:brightness-110 hover:shadow-lg hover:shadow-nerve/20"
                    >
                        Download Agent
                    </Link>
                </div>
            </div>
        );
    }

    /* ───── Metric Gauge ───── */
    const MetricGauge = ({ label, value, color }: { label: string; value: number | null; color: string }) => {
        const v = value ?? 0;
        const colorClasses: Record<string, { text: string; bar: string }> = {
            nerve: { text: 'text-nerve', bar: 'bg-nerve' },
            cortex: { text: 'text-cortex', bar: 'bg-cortex' },
            oracle: { text: 'text-oracle', bar: 'bg-oracle' },
        };
        const c = colorClasses[color] || colorClasses.nerve;
        return (
            <div>
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-3xl font-bold ${c.text}`}>{v.toFixed(1)}%</p>
                <div className="mt-2 w-full h-1.5 rounded-full bg-slate-800">
                    <div className={`${c.bar} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${v}%` }} />
                </div>
            </div>
        );
    };

    /* ───── Agent Dashboard ───── */
    return (
        <>
            {/* Header */}
            <div className="mb-8 flex justify-between items-center animate-fade-in">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Agent Monitoring</h1>
                    <p className="text-sm text-slate-400">{agent.hostname} • {agent.platform}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${agentStatusBadge[agent.status] || agentStatusBadge.OFFLINE}`}>
                    {agent.status === 'ONLINE' && <span className="h-1.5 w-1.5 rounded-full bg-health-good animate-pulse" />}
                    {agent.status}
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Real-Time Metrics */}
                    {agent.status === 'ONLINE' && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <h2 className="text-sm font-semibold text-white mb-5">Real-Time Metrics</h2>
                            <div className="grid grid-cols-3 gap-6">
                                <MetricGauge label="CPU Usage" value={agent.cpuUsage} color="nerve" />
                                <MetricGauge label="RAM Usage" value={agent.ramUsage} color="cortex" />
                                <MetricGauge label="Disk Usage" value={agent.diskUsage} color="oracle" />
                            </div>

                            {agent.networkUp !== null && (
                                <div className="mt-6 pt-5 border-t border-slate-800">
                                    <p className="text-xs text-slate-500 mb-3">Network Activity</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-slate-500">Upload</p>
                                            <p className="text-xl font-bold text-health-good">{agent.networkUp.toFixed(1)} KB/s</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Download</p>
                                            <p className="text-xl font-bold text-nerve">{agent.networkDown?.toFixed(1)} KB/s</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Historical Charts */}
                    {agent.status === 'ONLINE' && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-sm font-semibold text-white">Historical Metrics</h2>
                                <div className="flex gap-1">
                                    {(['1h', '24h', '7d', '30d'] as const).map((range) => (
                                        <button type="button"
                                            key={range}
                                            onClick={() => setTimeRange(range)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${timeRange === range
                                                ? 'bg-nerve/10 text-nerve'
                                                : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                                                }`}
                                        >
                                            {range}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {loadingMetrics ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-nerve" />
                                </div>
                            ) : metrics.length > 0 ? (
                                <MetricsChart data={metrics} timeRange={timeRange} />
                            ) : (
                                <p className="text-center text-sm text-slate-500 py-12">No historical data available</p>
                            )}
                        </div>
                    )}

                    {/* Script Executor */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                        <h2 className="text-sm font-semibold text-white mb-5">Execute Remote Script</h2>
                        <form onSubmit={executeScript} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Script Name</label>
                                <input
                                    type="text"
                                    value={scriptName}
                                    onChange={(e) => setScriptName(e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white
                                                       placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder="e.g., Check Disk Space"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Language</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value as 'powershell' | 'bash' | 'python')}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white
                                                       focus:outline-none focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                >
                                    <option value="powershell">PowerShell (Windows)</option>
                                    <option value="bash">Bash (macOS/Linux)</option>
                                    <option value="python">Python</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Script</label>
                                <textarea
                                    rows={6}
                                    value={scriptBody}
                                    onChange={(e) => setScriptBody(e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white font-mono
                                                       placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder={
                                        language === 'powershell' ? 'Get-PSDrive -PSProvider FileSystem' :
                                            language === 'bash' ? 'df -h' :
                                                'import os\nprint(os.listdir())'
                                    }
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={executing || agent.status !== 'ONLINE'}
                                className="w-full rounded-xl bg-nerve py-2.5 text-sm font-medium text-white
                                                   transition-all hover:brightness-110 hover:shadow-lg hover:shadow-nerve/20
                                                   disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:hover:shadow-none"
                            >
                                {executing ? 'Queueing…' : 'Execute Script'}
                            </button>

                            {agent.status !== 'ONLINE' && (
                                <p className="text-xs text-oracle">
                                    Agent is offline. Script will be queued and executed when agent comes online.
                                </p>
                            )}
                        </form>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Agent Info */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-5">
                        <h3 className="text-sm font-semibold text-white mb-4">Agent Info</h3>
                        <div className="space-y-3 text-sm">
                            <InfoRow label="Version" value={agent.agentVersion} />
                            {agent.ipAddress && <InfoRow label="IP Address" value={agent.ipAddress} />}
                            {agent.macAddress && <InfoRow label="MAC Address" value={agent.macAddress} />}
                            <InfoRow label="Last Seen" value={formatDateTime(agent.lastSeen)} />
                        </div>
                    </div>

                    {/* Recent Executions */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-5">
                        <h3 className="text-sm font-semibold text-white mb-4">Recent Executions</h3>
                        {executions.length === 0 ? (
                            <p className="text-xs text-slate-500">No executions yet</p>
                        ) : (
                            <div className="space-y-3">
                                {executions.slice(0, 5).map((exec) => (
                                    <div key={exec.id} className="text-sm">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <p className="font-medium text-slate-200 text-xs">{exec.scriptName}</p>
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadge[exec.status] || 'bg-slate-700/50 text-slate-400 border-slate-600/30'}`}>
                                                {exec.status}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500">
                                            {formatDateTime(exec.createdAt)}
                                            {exec.exitCode !== null && ` • exit ${exec.exitCode}`}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Execution History */}
            {executions.length > 0 && (
                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                    <div className="border-b border-slate-800 px-5 py-4">
                        <h2 className="text-sm font-semibold text-white">Execution History</h2>
                    </div>
                    <div className="divide-y divide-slate-800/50">
                        {executions.map((exec) => (
                            <div key={exec.id} className="p-5 hover:bg-slate-800/30 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-200">{exec.scriptName}</h3>
                                        <p className="text-xs text-slate-500">
                                            {exec.language} • {formatDateTime(exec.createdAt)}
                                        </p>
                                    </div>
                                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${statusBadge[exec.status] || 'bg-slate-700/50 text-slate-400 border-slate-600/30'}`}>
                                        {exec.status}
                                    </span>
                                </div>

                                {exec.output && (
                                    <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-health-good overflow-x-auto">
                                        <pre>{exec.output}</pre>
                                    </div>
                                )}

                                {exec.error && (
                                    <div className="mt-3 p-3 rounded-lg bg-health-critical/5 border border-health-critical/20 font-mono text-xs text-health-critical overflow-x-auto">
                                        <pre>{exec.error}</pre>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-sm font-medium text-slate-200">{value}</p>
        </div>
    );
}
