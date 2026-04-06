'use client';

import { useState, useEffect } from 'react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { Monitor, RefreshCw, XCircle, Play, Clock, Search, ChevronLeft, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import Link from 'next/link';

interface RemoteSession {
    id: string;
    status: 'ACTIVE' | 'DISCONNECTED' | 'TERMINATED' | 'ERROR';
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    endedAt: string | null;
    asset: {
        id: string;
        name: string;
        category: string | null;
        status: string;
    };
    user: {
        id: string;
        name: string | null;
        email: string;
        role: string;
    };
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Wifi }> = {
    ACTIVE: { label: 'Active', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: Wifi },
    DISCONNECTED: { label: 'Disconnected', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: WifiOff },
    TERMINATED: { label: 'Terminated', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: XCircle },
    ERROR: { label: 'Error', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
};

export default function RemoteSessionsPage() {
    const { success: toastSuccess, error: toastError } = useToast();

    const [sessions, setSessions] = useState<RemoteSession[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [terminatingId, setTerminatingId] = useState<string | null>(null);

    const fetchSessions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '15',
                ...(statusFilter && { status: statusFilter }),
            });
            const res = await csrfFetch(`/api/remote/sessions?${queryParams}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to fetch sessions');
            }
            const data = await res.json();
            setSessions(data.data?.sessions || []);
            setPagination(data.data?.pagination || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [page, statusFilter]);

    const handleTerminate = async (sessionId: string) => {
        setTerminatingId(sessionId);
        try {
            const res = await csrfFetch(`/api/remote/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'TERMINATED' }),
            });
            if (!res.ok) throw new Error('Failed to terminate session');
            toastSuccess('Session Terminated', 'Remote desktop session ended successfully.');
            fetchSessions();
        } catch {
            toastError('Error', 'Could not terminate session');
        } finally {
            setTerminatingId(null);
        }
    };

    const formatDuration = (start: string, end: string | null): string => {
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const diffMs = endTime - startTime;
        const mins = Math.floor(diffMs / 60000);
        const hours = Math.floor(mins / 60);
        if (hours > 0) return `${hours}h ${mins % 60}m`;
        return `${mins}m`;
    };

    // Client-side search filtering
    const filteredSessions = searchQuery
        ? sessions.filter(s =>
            s.asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.user.name || s.user.email).toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.id.includes(searchQuery)
        )
        : sessions;

    const activeSessions = sessions.filter(s => s.status === 'ACTIVE');

    if (isLoading && sessions.length === 0) {
        return <SkeletonDashboard />;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Remote Desktop Sessions</h1>
                    <p className="text-muted-foreground">
                        Manage live and historical remote connections to managed assets.
                        {activeSessions.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Wifi className="w-3 h-3" />
                                {activeSessions.length} Active
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchSessions}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-2 text-white rounded-lg hover:bg-surface-3 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-surface-1 border border-border p-4 rounded-xl flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by asset name, user, or session ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-nerve"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="w-full sm:w-52 px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-nerve appearance-none"
                >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DISCONNECTED">Disconnected</option>
                    <option value="TERMINATED">Terminated</option>
                    <option value="ERROR">Error</option>
                </select>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl">
                    <p className="font-medium">Error loading sessions</p>
                    <p className="text-sm opacity-80">{error}</p>
                </div>
            )}

            {/* Sessions Grid */}
            {!error && (
                <div className="space-y-3">
                    {filteredSessions.length === 0 ? (
                        <div className="bg-surface-1 border border-border rounded-xl p-12 text-center">
                            <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">No Sessions Found</h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                {statusFilter ? 'No sessions match the selected filter.' : 'No remote desktop sessions have been initiated yet.'}
                            </p>
                        </div>
                    ) : (
                        filteredSessions.map((session) => {
                            const config = STATUS_CONFIG[session.status] || STATUS_CONFIG.TERMINATED;
                            const StatusIcon = config.icon;
                            return (
                                <div key={session.id} className="bg-surface-1 border border-border rounded-xl p-5 hover:border-nerve/30 transition-colors group">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            {/* Status Icon */}
                                            <div className={`flex items-center justify-center w-10 h-10 rounded-xl border ${config.color} shrink-0`}>
                                                <StatusIcon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {/* Asset & Session Info */}
                                                <div className="flex items-center gap-3 mb-1">
                                                    <Link href={`/assets/${session.asset.id}`}
                                                        className="text-base font-semibold text-foreground hover:text-nerve transition-colors truncate">
                                                        {session.asset.name}
                                                    </Link>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${config.color}`}>
                                                        {config.label}
                                                    </span>
                                                    {session.asset.category && (
                                                        <span className="text-xs text-muted-foreground bg-surface-2 px-2 py-0.5 rounded">
                                                            {session.asset.category}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Meta Row */}
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span>by <span className="text-foreground font-medium">{session.user.name || session.user.email}</span></span>
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(session.createdAt, session.endedAt)}</span>
                                                    <span>{new Date(session.createdAt).toLocaleString()}</span>
                                                    <span className="font-mono text-2xs opacity-60">{session.id.slice(0, 8)}</span>
                                                </div>

                                                {/* Notes */}
                                                {session.notes && (
                                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{session.notes}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {session.status === 'ACTIVE' && (
                                                <>
                                                    <Link href={`/remote/host/${session.id}`}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-nerve/30 text-nerve rounded-lg hover:bg-nerve/10 transition-colors">
                                                        <Play className="w-3.5 h-3.5" />
                                                        Connect
                                                    </Link>
                                                    <button
                                                        onClick={() => handleTerminate(session.id)}
                                                        disabled={terminatingId === session.id}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        {terminatingId === session.id ? 'Ending...' : 'Terminate'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="bg-surface-1 border border-border rounded-xl px-6 py-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        Showing <span className="font-medium text-white">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                        <span className="font-medium text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
                        <span className="font-medium text-white">{pagination.total}</span> sessions
                    </span>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page === 1}
                            className="px-3 py-1.5 text-sm font-medium bg-surface-2 border border-border rounded-md hover:bg-surface-3 transition-colors disabled:opacity-50">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1.5 text-sm font-medium text-muted-foreground">
                            {pagination.page} / {pagination.totalPages}
                        </span>
                        <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page === pagination.totalPages}
                            className="px-3 py-1.5 text-sm font-medium bg-surface-2 border border-border rounded-md hover:bg-surface-3 transition-colors disabled:opacity-50">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
