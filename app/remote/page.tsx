'use client';
import Link from 'next/link';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/lib/toast';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

    useEffect(() => {
        fetchSessions();
    }, [statusFilter]);

    const fetchSessions = async () => {
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') {
                params.append('status', statusFilter);
            }

            const response = await csrfFetch(`/api/remote/sessions?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch sessions');

            const data = await response.json();
            setSessions(data.sessions || []);
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
                return 'bg-slate-800/50 text-slate-200';
            case 'FAILED':
                return 'bg-health-critical/15 text-health-critical';
            default:
                return 'bg-slate-800/50 text-slate-200';
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
            </div>

            {/* Requirements banner */}
            <div className="mb-6 rounded-xl border border-nerve/20 bg-nerve/5 px-4 py-3">
                <p className="text-xs text-nerve/90">
                    <span className="font-semibold">Requirements:</span>{' '}
                    Remote desktop connections require the Glanus Agent installed on target machines
                    and a WebRTC signaling server. See the{' '}
                    <Link href="/download-agent" className="underline hover:text-white">agent download page</Link>
                    {' '}for setup instructions.
                </p>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-foreground">Status:</label>
                    <div className="flex gap-2">
                        {['ALL', 'ACTIVE', 'ENDED', 'FAILED'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === status
                                    ? 'bg-nerve text-white'
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
                <div className="card overflow-hidden">
                    <table className="min-w-full divide-y divide-border">
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
                                            <button className="text-muted-foreground hover:text-foreground">
                                                View Details
                                            </button>
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
