'use client';
import Link from 'next/link';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/lib/toast';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Plus, X } from 'lucide-react';

interface RemoteSession {
    id: string;
    status: string;
    startedAt: string;
    endedAt?: string;
    duration?: number;
    quality?: string;
    averageLatency?: number;
    averageFPS?: number;
    asset: {
        id: string;
        name: string;
        category: string;
        status: string;
    };
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
}

export default function RemoteSessionsPage() {
    const { error: showError } = useToast();
    const router = useRouter();
    const [sessions, setSessions] = useState<RemoteSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [showNewSession, setShowNewSession] = useState(false);
    const [assets, setAssets] = useState<Array<{ id: string; name: string; category: string }>>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [connectingAssetId, setConnectingAssetId] = useState<string | null>(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const fetchSessions = async () => {
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') {
                params.append('status', statusFilter);
            }

            const response = await csrfFetch(`/api/remote/sessions?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch sessions');

            const body = await response.json();
            // API returns { success, data: { sessions, pagination } } — unwrap both envelopes.
            const payload = body?.data ?? body;
            setSessions(payload?.sessions || []);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
            showError('Error fetching sessions:', msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-health-good/15 text-health-good';
            case 'ENDED':
                return 'bg-muted/50 text-foreground';
            case 'FAILED':
                return 'bg-health-critical/15 text-health-critical';
            default:
                return 'bg-muted/50 text-foreground';
        }
    };

    const formatDuration = (seconds?: number): string => {
        if (!seconds) return 'N/A';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    };

    if (loading) return <PageSpinner text="Loading sessions…" />;
    if (error) return <ErrorState title="Failed to load sessions" description={error} onRetry={() => window.location.reload()} />;

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Remote Sessions</h1>
                    <p className="text-muted-foreground mt-1">Manage and monitor remote desktop sessions</p>
                </div>
                <button type="button"
                    onClick={async () => {
                        setShowNewSession(!showNewSession);
                        if (!showNewSession && assets.length === 0) {
                            setAssetsLoading(true);
                            try {
                                const res = await csrfFetch('/api/assets?limit=50');
                                if (res.ok) {
                                    const data = await res.json();
                                    const assetsList = data.data?.assets || data.assets || (Array.isArray(data) ? data : []);
                                    setAssets(assetsList.map((a: any) => ({ id: a.id, name: a.name, category: a.category?.name || a.category || 'Uncategorized' })));
                                }
                            } catch { /* ignore */ }
                            setAssetsLoading(false);
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all"
                >
                    <Plus size={16} />
                    New Session
                </button>
            </div>

            {/* New Session Panel */}
            {showNewSession && (
                <div className="mb-6 rounded-xl border border-nerve/30 bg-nerve/5 p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-foreground">Select an asset to connect to</h3>
                        <button type="button" onClick={() => setShowNewSession(false)} className="text-muted-foreground hover:text-foreground">
                            <X size={16} />
                        </button>
                    </div>
                    {assetsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading assets…</p>
                    ) : assets.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No assets found. Make sure assets are added to a workspace.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {assets.map((asset) => (
                                <button type="button"
                                    key={asset.id}
                                    onClick={async () => {
                                        try {
                                            setConnectingAssetId(asset.id);
                                            const res = await csrfFetch('/api/remote/sessions', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ assetId: asset.id }),
                                            });
                                            if (!res.ok) {
                                                const data = await res.json();
                                                throw new Error(data.error || 'Failed to start session');
                                            }
                                            const session = await res.json();
                                            const sessionId = session.data?.id || session.id;
                                            router.push(`/remote/${sessionId}`);
                                        } catch (err: unknown) {
                                            showError('Connection Failed', err instanceof Error ? err.message : 'Could not start remote session');
                                        } finally {
                                            setConnectingAssetId(null);
                                        }
                                    }}
                                    disabled={connectingAssetId === asset.id}
                                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-nerve/50 hover:bg-nerve/5 transition-all text-left disabled:opacity-50"
                                >
                                    <Monitor size={16} className="text-nerve shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{asset.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{asset.category}</p>
                                    </div>
                                    {connectingAssetId === asset.id && (
                                        <span className="text-xs text-nerve ml-auto">Connecting…</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Requirements banner */}
            <div className="mb-6 rounded-xl border border-nerve/20 bg-nerve/5 px-4 py-3">
                <p className="text-xs text-nerve/90">
                    <span className="font-semibold">Requirements:</span>{' '}
                    Remote desktop connections require the Glanus Agent installed on target machines
                    and a WebRTC signaling server. See the{' '}
                    <Link href="/download-agent" className="underline hover:text-foreground">agent download page</Link>
                    {' '}for setup instructions.
                </p>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-foreground">Status:</label>
                    <div className="flex gap-2">
                        {['ALL', 'ACTIVE', 'ENDED', 'FAILED'].map((status) => (
                            <button type="button"
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === status
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sessions Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nerve" />
                </div>
            ) : sessions.length === 0 ? (
                <EmptyState icon="🖥️" title="No remote sessions" description="Remote sessions will appear here once you connect to agents." />

            ) : (
                <div className="card overflow-hidden overflow-x-auto">
                    <table className="min-w-[800px] divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Asset
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Started
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Duration
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Quality
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-background divide-y divide-border">
                            {sessions.map((session) => (
                                <tr key={session.id} className="hover:bg-muted/50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Link
                                            href={`/assets/${session.asset.id}`}
                                            className="text-sm font-medium text-nerve hover:underline"
                                        >
                                            {session.asset.name}
                                        </Link>
                                        <div className="text-sm text-muted-foreground">{session.asset.category}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-foreground">{session.user.name}</div>
                                        <div className="text-sm text-muted-foreground">{session.user.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`badge ${getStatusColor(session.status)}`}>
                                            {session.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                        {formatDateTime(session.startedAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                        {formatDuration(session.duration)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {session.averageLatency && session.averageFPS ? (
                                            <div className="text-sm">
                                                <div className="text-foreground">{session.quality || 'N/A'}</div>
                                                <div className="text-muted-foreground">
                                                    {session.averageLatency}ms · {session.averageFPS}fps
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {session.status === 'ACTIVE' ? (
                                            <Link
                                                href={`/remote/${session.id}`}
                                                className="btn-primary text-sm px-3 py-1"
                                            >
                                                Join
                                            </Link>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">
                                                {session.status}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
