'use client';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { ArrowLeft, Send, AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface TicketMessage {
    id: string;
    content: string;
    isInternal: boolean;
    createdAt: string;
    sender: { id: string, name: string | null, email: string, role: string };
}

interface TicketDetail {
    id: string;
    number: number;
    title: string;
    description: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    createdAt: string;
    creator: { id: string, name: string | null, email: string };
    assignee?: { id: string, user: { name: string | null, email: string } } | null;
    asset?: { id: string, name: string, assetType: string } | null;
    messages: TicketMessage[];
}

function TicketHeader({ ticket, onStatusChange }: { ticket: TicketDetail, onStatusChange: (status: string) => void }) {
    const router = useRouter();

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container border border-border/50 p-6 rounded-xl shadow-sm">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(`/workspaces/helpdesk`)}
                        className="btn-ghost h-8 w-8 p-0 -ml-1"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="badge text-xs px-2 rounded-md bg-surface-container-highest text-on-surface border border-border">#{ticket.number}</span>
                    <h1 className="text-xl font-semibold tracking-tight text-on-surface">{ticket.title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground ml-10">
                    <span>Created by <span className="text-on-surface font-medium">{ticket.creator.name || ticket.creator.email}</span></span>
                    {ticket.asset && (
                        <span>Asset: <span className="text-primary font-medium hover:underline cursor-pointer">{ticket.asset.name}</span></span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <select
                    className="bg-surface-container-low border-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all text-sm rounded-lg px-3 py-2 text-on-surface outline-none appearance-none"
                    value={ticket.status}
                    onChange={(e) => onStatusChange(e.target.value)}
                >
                    <option value="OPEN">Status: Open</option>
                    <option value="IN_PROGRESS">Status: In Progress</option>
                    <option value="WAITING_ON_CUSTOMER">Status: Waiting</option>
                    <option value="RESOLVED">Status: Resolved</option>
                    <option value="CLOSED">Status: Closed</option>
                </select>

                {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                    <button className="btn-primary h-9 px-4 gap-2" onClick={() => onStatusChange('RESOLVED')}>
                        <CheckCircle className="h-4 w-4" /> Resolve Issue
                    </button>
                )}
            </div>
        </div>
    );
}

function TicketThreadContent() {
    const params = useParams();
    const workspaceId = useWorkspaceId();
    const ticketId = params?.ticketId as string;
    const { error: showError, success: showSuccess } = useToast();

    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const [replyContent, setReplyContent] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [sending, setSending] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (workspaceId && ticketId) fetchTicket();
    }, [workspaceId, ticketId]);

    useEffect(() => {
        // Auto-scroll to bottom of messages
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [ticket?.messages]);

    const fetchTicket = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/tickets/${ticketId}`);
            if (!res.ok) throw new Error('Failed to fetch ticket thread');
            const data = await res.json();
            setTicket(data.data?.ticket);
        } catch (err: any) {
            showError('Data Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/tickets/${ticketId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error('Failed to update ticket status');
            showSuccess('Status Updated', `Ticket marked as ${newStatus}`);
            fetchTicket();
        } catch (err: any) {
            showError('Update Failed', err.message);
        }
    };

    const handleSendReply = async () => {
        if (!replyContent.trim()) return;
        setSending(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/tickets/${ticketId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content: replyContent, isInternal })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to send message');
            }

            setReplyContent('');
            setIsInternal(false);
            fetchTicket();
        } catch (err: any) {
            showError('Message Failed', err.message);
        } finally {
            setSending(false);
        }
    };

    if (loading) return <PageSpinner />;
    if (!ticket) return <div className="p-12 text-center text-muted-foreground bg-surface-container rounded-xl">Ticket not found or access denied.</div>;

    const isClosed = ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col pt-1">
            <TicketHeader ticket={ticket} onStatusChange={handleStatusChange} />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
                    {/* Message Thread */}
                    <div className="flex-1 border border-border bg-surface-container rounded-xl shadow-sm overflow-hidden flex flex-col">
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-border/80 scrollbar-track-transparent"
                        >
                            {ticket.messages.length === 0 ? (
                                <div className="text-center text-sm text-muted-foreground mt-10">No messages yet.</div>
                            ) : null}

                            {ticket.messages.map((msg) => {
                                const isStaff = msg.sender.role === 'ADMIN' || msg.sender.role === 'IT_STAFF' || msg.sender.role === 'OWNER';

                                return (
                                    <div key={msg.id} className={`flex gap-4 ${msg.isInternal ? 'opacity-90' : ''}`}>
                                        <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-sm border shadow-sm
                                            ${isStaff ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-container-highest text-on-surface border-border'}
                                        `}>
                                            {(msg.sender.name || msg.sender.email).charAt(0).toUpperCase()}
                                        </div>

                                        <div className={`flex-1 rounded-2xl p-4 shadow-sm ${msg.isInternal
                                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500/90'
                                            : isStaff ? 'bg-surface-container-low border border-border' : 'bg-surface-container-highest border border-border/50'
                                            }`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-on-surface text-sm">{msg.sender.name || 'User'}</span>
                                                    {isStaff && <span className="badge text-[10px] px-1.5 h-4 bg-primary/10 text-primary border border-primary/20 rounded">Support API</span>}
                                                    {msg.isInternal && <span className="badge text-[10px] px-1.5 h-4 flex gap-1 items-center bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded"><Shield className="h-2.5 w-2.5" /> Internal Note</span>}
                                                </div>
                                                <span className="text-xs text-muted-foreground font-medium">
                                                    {new Date(msg.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="text-on-surface text-sm whitespace-pre-wrap leading-relaxed">
                                                {msg.content}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Reply Composer */}
                        <div className="p-4 bg-surface-container-low border-t border-border">
                            {isClosed ? (
                                <div className="text-center p-4 text-sm text-muted-foreground bg-surface-container rounded-lg border border-border border-dashed">
                                    This ticket has been resolved. You cannot send new messages unless it is reopened.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <textarea
                                        className={`w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all resize-none min-h-[100px] shadow-sm
                                            ${isInternal 
                                                ? 'bg-amber-500/5 text-amber-100 border-amber-500/30 focus:ring-amber-500 focus:ring-offset-surface-container-low placeholder:text-amber-500/50' 
                                                : 'bg-surface-container text-on-surface border-border focus:ring-primary focus:ring-offset-surface-container-low placeholder:text-muted-foreground'}
                                        `}
                                        placeholder={isInternal ? "Write a private internal note (not visible to users)..." : "Draft a reply to the user..."}
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !sending) {
                                                e.preventDefault();
                                                handleSendReply();
                                            }
                                        }}
                                    />
                                    <div className="flex justify-between items-center px-1">
                                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                className="rounded bg-surface-container border-border text-primary focus:ring-primary focus:ring-offset-surface-container-low cursor-pointer"
                                                checked={isInternal}
                                                onChange={(e) => setIsInternal(e.target.checked)}
                                            />
                                            <Shield className={`h-4 w-4 ${isInternal ? "text-amber-500" : "text-muted-foreground group-hover:text-on-surface"}`} />
                                            <span className="group-hover:text-on-surface transition-colors">Post as Internal IT Note</span>
                                        </label>

                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-muted-foreground hidden sm:block font-medium">⌘ / Ctrl + Enter to send</span>
                                            <button
                                                onClick={handleSendReply}
                                                disabled={!replyContent.trim() || sending}
                                                className={`btn-primary h-9 px-4 gap-2 ${isInternal ? '!bg-amber-600 hover:!bg-amber-700 !text-white !shadow-amber-500/20' : ''}`}
                                            >
                                                <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send Reply'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Meta Sidebar */}
                <div className="space-y-4">
                    <div className="border-border bg-surface-container border rounded-xl shadow-sm overflow-hidden">
                        <div className="p-5 space-y-5">
                            <div>
                                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Priority</h3>
                                <div className="flex items-center gap-2 text-sm font-semibold text-on-surface bg-surface-container-low p-2 rounded-lg border border-border">
                                    {ticket.priority === 'URGENT' && <AlertTriangle className="h-4 w-4 text-health-critical" />}
                                    {ticket.priority}
                                </div>
                            </div>

                            <hr className="border-border/50" />

                            <div>
                                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Assignment</h3>
                                {ticket.assignee ? (
                                    <div className="flex items-center gap-3 bg-surface-container-low p-2.5 rounded-lg border border-border">
                                        <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-xs font-bold text-on-surface border border-border/50 shrink-0 shadow-sm">
                                            {(ticket.assignee.user.name || ticket.assignee.user.email).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-on-surface truncate">{ticket.assignee.user.name || 'Agent'}</div>
                                            <div className="text-xs text-muted-foreground truncate">{ticket.assignee.user.email}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground italic bg-surface-container-low p-3 rounded-lg border border-border border-dashed text-center">Unassigned</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TicketThreadPage() {
    return (
        <WorkspaceLayout>
            <Suspense fallback={<PageSpinner />}>
                <TicketThreadContent />
            </Suspense>
        </WorkspaceLayout>
    );
}
