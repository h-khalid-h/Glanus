'use client';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { ArrowLeft, Send, AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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
    const workspaceId = useWorkspaceId();

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(`/workspaces/helpdesk`)}
                        className="text-slate-400 hover:text-white transition-colors p-1 -ml-1"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <Badge variant="primary" className="font-mono text-xs">#{ticket.number}</Badge>
                    <h1 className="text-xl font-bold text-slate-100">{ticket.title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 ml-8">
                    <span>Created by <span className="text-slate-200">{ticket.creator.name || ticket.creator.email}</span></span>
                    {ticket.asset && (
                        <span>Asset: <span className="text-indigo-400 cursor-pointer">{ticket.asset.name}</span></span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <select
                    className="bg-slate-950 border border-slate-800 text-sm rounded-md px-3 py-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                    <Button variant="primary" className="gap-2" onClick={() => onStatusChange('RESOLVED')}>
                        <CheckCircle size={16} /> Resolve Issue
                    </Button>
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
    if (!ticket) return <div className="p-8 text-center text-slate-400">Ticket not found or access denied.</div>;

    const isClosed = ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <TicketHeader ticket={ticket} onStatusChange={handleStatusChange} />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
                    {/* Message Thread */}
                    <Card className="flex-1 border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col">
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-700"
                        >
                            {ticket.messages.map((msg) => {
                                const isStaff = msg.sender.role === 'ADMIN' || msg.sender.role === 'IT_STAFF' || msg.sender.role === 'OWNER';

                                return (
                                    <div key={msg.id} className={`flex gap-4 ${msg.isInternal ? 'opacity-90' : ''}`}>
                                        <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-sm border
                                            ${isStaff ? 'bg-indigo-900/50 text-indigo-300 border-indigo-800' : 'bg-slate-800 text-slate-300 border-slate-700'}
                                        `}>
                                            {(msg.sender.name || msg.sender.email).charAt(0).toUpperCase()}
                                        </div>

                                        <div className={`flex-1 rounded-2xl p-4 ${msg.isInternal
                                            ? 'bg-amber-900/20 border border-amber-800/50'
                                            : isStaff ? 'bg-slate-800/40 border border-slate-800' : 'bg-slate-800/80'
                                            }`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-slate-200">{msg.sender.name || 'User'}</span>
                                                    {isStaff && <Badge variant="primary" className="text-[10px] px-1.5 h-4 bg-indigo-950/50 text-indigo-400 border-indigo-800">Support API</Badge>}
                                                    {msg.isInternal && <Badge variant="warning" className="text-[10px] px-1.5 h-4 flex gap-1"><Shield size={10} /> Internal Note</Badge>}
                                                </div>
                                                <span className="text-xs text-slate-500">
                                                    {new Date(msg.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                                                {msg.content}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Reply Composer */}
                        <div className="p-4 bg-slate-950 border-t border-slate-800">
                            {isClosed ? (
                                <div className="text-center p-4 text-sm text-slate-500 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                                    This ticket has been resolved. You cannot send new messages unless it is reopened.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <textarea
                                        className={`w-full bg-slate-900 border ${isInternal ? 'border-amber-700/50 focus:ring-amber-500' : 'border-slate-800 focus:ring-indigo-500'} rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 resize-none min-h-[100px]`}
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
                                    <div className="flex justify-between items-center">
                                        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-950"
                                                checked={isInternal}
                                                onChange={(e) => setIsInternal(e.target.checked)}
                                            />
                                            <Shield size={14} className={isInternal ? "text-amber-500" : ""} />
                                            Post as Internal IT Note
                                        </label>

                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-slate-500 hidden sm:block">Ctrl + Enter to send</span>
                                            <Button
                                                onClick={handleSendReply}
                                                disabled={!replyContent.trim() || sending}
                                                className={`gap-2 ${isInternal ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                                            >
                                                <Send size={16} /> {sending ? 'Sending...' : 'Send Reply'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Meta Sidebar */}
                <div className="space-y-4">
                    <Card className="border-slate-800 bg-slate-900/50">
                        <CardContent className="p-5 space-y-4">
                            <div>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Priority</h3>
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                                    {ticket.priority === 'URGENT' && <AlertTriangle size={14} className="text-rose-500" />}
                                    {ticket.priority}
                                </div>
                            </div>

                            <hr className="border-slate-800" />

                            <div>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Assignment</h3>
                                {ticket.assignee ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700">
                                            {(ticket.assignee.user.name || ticket.assignee.user.email).charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm text-slate-300">{ticket.assignee.user.name || 'Agent'}</span>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-400">Unassigned</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
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
