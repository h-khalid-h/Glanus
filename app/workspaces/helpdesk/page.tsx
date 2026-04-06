'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { LifeBuoy, Plus, MessageSquare, Clock, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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
        case 'OPEN': return <Badge variant="info">Open</Badge>;
        case 'IN_PROGRESS': return <Badge variant="warning">In Progress</Badge>;
        case 'WAITING_ON_CUSTOMER': return <Badge variant="warning">Waiting</Badge>;
        case 'RESOLVED': return <Badge variant="success">Resolved</Badge>;
        case 'CLOSED': return <Badge variant="primary">Closed</Badge>;
        default: return <Badge variant="primary">{status}</Badge>;
    }
}

function getPriorityIcon(priority: string) {
    switch (priority) {
        case 'URGENT': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
        case 'HIGH': return <div className="w-2 h-2 rounded-full bg-orange-500" />;
        case 'NORMAL': return <div className="w-2 h-2 rounded-full bg-blue-500" />;
        case 'LOW': return <div className="w-2 h-2 rounded-full bg-slate-500" />;
        default: return null;
    }
}

function HelpdeskDashboardContent() {
    const router = useRouter();
    const workspaceId = useWorkspaceId();
    const { error: showError } = useToast();

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        if (workspaceId) {
            fetchTickets();
        }
    }, [workspaceId, statusFilter]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const url = statusFilter ? `/api/workspaces/${workspaceId}/tickets?status=${statusFilter}` : `/api/workspaces/${workspaceId}/tickets`;
            const res = await csrfFetch(url);
            if (!res.ok) throw new Error('Failed to fetch support tickets');
            const data = await res.json();
            setTickets(data.data?.tickets || []);
        } catch (err: unknown) {
            showError('Data Error', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (loading && tickets.length === 0) return <PageSpinner />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Helpdesk Tickets</h1>
                    <p className="text-sm text-slate-400 mt-1">Manage and respond to user IT support requests.</p>
                </div>
                <div className="flex gap-2">
                    <select
                        className="bg-slate-900 border border-slate-800 text-sm rounded-md px-3 py-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Tickets</option>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="WAITING_ON_CUSTOMER">Waiting on Customer</option>
                        <option value="RESOLVED">Resolved / Closed</option>
                    </select>
                    <Button className="gap-2" onClick={() => router.push(`/workspaces/helpdesk/new`)}>
                        <Plus size={16} /> New Ticket
                    </Button>
                </div>
            </div>

            {tickets.length === 0 ? (
                <EmptyState
                    icon={<LifeBuoy className="w-16 h-16 text-slate-600" />}
                    title="No Tickets Found"
                    description={statusFilter ? "There are no tickets matching this filter criteria." : "Your helpdesk queue is empty. New support requests will appear here."}
                    action={{ label: 'Create First Ticket', onClick: () => router.push(`/workspaces/helpdesk/new`) }}
                />
            ) : (
                <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
                                <tr>
                                    <th className="px-5 py-4 font-medium">Ticket</th>
                                    <th className="px-5 py-4 font-medium">Status / Priority</th>
                                    <th className="px-5 py-4 font-medium">Requester</th>
                                    <th className="px-5 py-4 font-medium">Assignee</th>
                                    <th className="px-5 py-4 font-medium">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {tickets.map((ticket) => (
                                    <tr
                                        key={ticket.id}
                                        onClick={() => router.push(`/workspaces/helpdesk/${ticket.id}`)}
                                        className="hover:bg-slate-800/20 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-5 py-4">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 flex-shrink-0">
                                                    <LifeBuoy className="w-5 h-5 text-indigo-400/70 group-hover:text-indigo-400 transition-colors" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-200 mb-1">
                                                        #{ticket.number} — {ticket.title}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <MessageSquare className="w-3 h-3" /> {ticket._count.messages}
                                                        </span>
                                                        {ticket.asset && (
                                                            <span className="truncate max-w-[120px]">
                                                                Device: {ticket.asset.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-2 items-start">
                                                {getStatusBadge(ticket.status)}
                                                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                                    {getPriorityIcon(ticket.priority)} {ticket.priority}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div className="text-slate-300 font-medium">{ticket.creator.name || 'Anonymous User'}</div>
                                            <div className="text-xs text-slate-500">{ticket.creator.email}</div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            {ticket.assignee ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700">
                                                        {(ticket.assignee.user.name || ticket.assignee.user.email).charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-slate-300">{ticket.assignee.user.name || 'Agent'}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500 text-xs italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-slate-400 text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(ticket.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
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
