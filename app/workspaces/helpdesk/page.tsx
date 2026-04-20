'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { LifeBuoy, Plus, MessageSquare, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';

interface Ticket {
    id: string;
    number: number;
    title: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    createdAt: string;
    creator: { id: string, name: string | null, email: string };
    assignee?: { id: string, user: { name: string | null, email: string } } | null;
    asset?: { id: string, name: string, assetType: string } | null;
    _count: { messages: number };
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'OPEN': return <span className="badge text-[10px] px-2 py-0.5 rounded-md bg-health-good/15 text-health-good border border-health-good/20">Open</span>;
        case 'IN_PROGRESS': return <span className="badge text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">In Progress</span>;
        case 'WAITING_ON_CUSTOMER': return <span className="badge text-[10px] px-2 py-0.5 rounded-md bg-health-warn/15 text-health-warn border border-health-warn/20">Waiting on Customer</span>;
        case 'RESOLVED': return <span className="badge text-[10px] px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground border border-muted">Resolved</span>;
        case 'CLOSED': return <span className="badge text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">Closed</span>;
        default: return <span className="badge text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">{status}</span>;
    }
}

function getPriorityIcon(priority: string) {
    switch (priority) {
        case 'URGENT': return <AlertTriangle className="w-4 h-4 text-destructive" />;
        case 'HIGH': return <div className="w-2 h-2 rounded-full bg-orange-500" />;
        case 'NORMAL': return <div className="w-2 h-2 rounded-full bg-cortex" />;
        case 'LOW': return <div className="w-2 h-2 rounded-full bg-muted" />;
        default: return null;
    }
}

function HelpdeskDashboardContent() {
    const router = useRouter();
    const workspaceId = useWorkspaceId();
    const { error: showError } = useToast();

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        if (workspaceId) {
            fetchTickets();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId, statusFilter]);

    const fetchTickets = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = statusFilter ? `/api/workspaces/${workspaceId}/tickets?status=${statusFilter}` : `/api/workspaces/${workspaceId}/tickets`;
            const res = await csrfFetch(url);
            if (!res.ok) throw new Error('Failed to fetch support tickets');
            const data = await res.json();
            setTickets(data.data?.tickets || []);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
            showError('Data Error', msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (loading && tickets.length === 0) return <PageSpinner text="Loading tickets…" />;
    if (error && tickets.length === 0) return <ErrorState title="Failed to load tickets" description={error} onRetry={() => fetchTickets()} />;

    const hasActiveFilters = !!statusFilter;

    return (
        <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Helpdesk Tickets</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {loading 
                            ? 'Loading…' 
                            : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}${hasActiveFilters ? ' matched' : ' total'}`}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/workspaces/helpdesk/new" className="inline-flex items-center gap-1.5 primary-gradient-btn text-on-primary font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all rounded-full px-6 py-2 text-sm">
                        <Plus className="h-4 w-4" />
                        New Ticket
                    </Link>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-8 p-3 bg-surface-container rounded-xl shadow-sm border border-border/40">
                <select
                    className="bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all py-2 pl-3 pr-8 text-on-surface text-sm outline-none appearance-none"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">All Tickets</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING_ON_CUSTOMER">Waiting on Customer</option>
                    <option value="RESOLVED">Resolved / Closed</option>
                </select>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={() => setStatusFilter('')}
                        className="btn-ghost h-8 text-sm text-muted-foreground inline-flex items-center gap-1 px-2"
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear filter
                    </button>
                )}
            </div>

            {loading && tickets.length === 0 ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                </div>
            ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4 border border-border">
                        <LifeBuoy className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                        {hasActiveFilters ? 'No tickets matched' : 'No tickets found'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                        {hasActiveFilters 
                            ? 'There are no tickets matching this filter criteria.' 
                            : 'Your helpdesk queue is empty. New support requests will appear here.'}
                    </p>
                    {!hasActiveFilters && (
                        <Link href="/workspaces/helpdesk/new" className="btn-primary mt-5 inline-flex items-center gap-1.5 text-sm h-9 px-4">
                            <Plus className="h-3.5 w-3.5" />
                            Create First Ticket
                        </Link>
                    )}
                </div>
            ) : (
                <div className="bg-surface-container border border-border rounded-xl shadow-sm overflow-hidden animate-fade-in">
                    <div className="divide-y divide-border/50">
                        {tickets.map((ticket, i) => (
                            <div
                                key={ticket.id}
                                onClick={() => router.push(`/workspaces/helpdesk/${ticket.id}`)}
                                className="p-4 hover:bg-surface-container-highest cursor-pointer transition-colors group flex flex-col md:flex-row md:items-center gap-4"
                                style={{ animationDelay: `${i * 15}ms`, animationFillMode: 'both' }}
                            >
                                <div className="flex-1 flex items-start gap-3">
                                    <div className="mt-1 flex-shrink-0">
                                        <LifeBuoy className="w-5 h-5 text-indigo-400/70 group-hover:text-indigo-400 transition-colors" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-on-surface mb-1 flex items-center gap-2">
                                            #{ticket.number} — {ticket.title}
                                        </div>
                                        <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <MessageSquare className="w-3.5 h-3.5" /> {ticket._count.messages}
                                            </span>
                                            {ticket.asset && (
                                                <span className="truncate max-w-[150px] bg-surface-container-low px-1.5 py-0.5 rounded border border-border/50">
                                                    Asset: {ticket.asset.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex items-center justify-between md:w-[450px] gap-4">
                                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                                        {getStatusBadge(ticket.status)}
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                            {getPriorityIcon(ticket.priority)} <span className="capitalize">{ticket.priority.toLowerCase()}</span>
                                        </div>
                                    </div>
                                    <div className="min-w-[120px] pr-2">
                                        <div className="text-on-surface text-sm font-medium truncate max-w-[120px]">{ticket.creator.name || 'Anonymous User'}</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[120px]">{ticket.creator.email}</div>
                                    </div>
                                    <div className="min-w-[100px] hidden md:block">
                                        {ticket.assignee ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground border border-border shrink-0">
                                                    {(ticket.assignee.user.name || ticket.assignee.user.email).charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-muted-foreground text-xs font-medium truncate max-w-[80px]">{ticket.assignee.user.name || 'Agent'}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-xs italic">Unassigned</span>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground text-xs whitespace-nowrap hidden lg:flex items-center gap-1.5 w-[80px] justify-end">
                                        {new Date(ticket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

export default function HelpdeskPage() {
    return (
        <WorkspaceLayout>
            <Suspense fallback={<PageSpinner />}>
                <HelpdeskDashboardContent />
            </Suspense>
        </WorkspaceLayout>
    );
}

