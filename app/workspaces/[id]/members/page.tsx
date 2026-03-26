'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import {
    UserPlus, ShieldAlert, Mail, MoreHorizontal, Clock,
    Trash2, ChevronDown, RefreshCw, ShieldCheck, Eye, Users,
} from 'lucide-react';

interface Member {
    id: string;
    userId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    joinedAt: string;
    user: {
        name: string | null;
        email: string;
    };
}

interface Invitation {
    id: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    expiresAt: string;
    inviter: { name: string | null; email: string } | null;
}

const roleConfig: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
    OWNER: { label: 'Owner', color: 'bg-health-good/10 text-health-good border-health-good/20', icon: ShieldAlert },
    ADMIN: { label: 'Admin', color: 'bg-nerve/10 text-nerve border-nerve/20', icon: ShieldCheck },
    MEMBER: { label: 'Member', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Users },
    VIEWER: { label: 'Viewer', color: 'bg-slate-800 text-slate-300 border-slate-700', icon: Eye },
};

export default function WorkspaceMembersPage() {
    const params = useParams();
    const workspaceId = params.id as string;
    const { success: toastSuccess, error: toastError } = useToast();

    const [members, setMembers] = useState<Member[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Invite Modal State
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('VIEWER');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Action menu
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

    const fetchMembers = useCallback(async () => {
        if (!workspaceId) return;
        try {
            setIsLoading(true);
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/members`);
            if (!res.ok) throw new Error('Failed to load members');
            const data = await res.json();
            setMembers(data.data?.members || data.members || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch members');
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    const fetchInvitations = useCallback(async () => {
        if (!workspaceId) return;
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/invitations`);
            if (!res.ok) return; // May not have access
            const data = await res.json();
            setInvitations(data.data?.invitations || []);
        } catch {
            // Silent — viewer may not have access
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchMembers();
        fetchInvitations();
    }, [fetchMembers, fetchInvitations]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setIsSubmitting(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || data.error || 'Failed to send invite');
            }
            setInviteEmail('');
            setInviteRole('VIEWER');
            setIsInviteModalOpen(false);
            toastSuccess('Invitation Sent', `An invitation has been sent to ${inviteEmail}`);
            fetchInvitations();
        } catch (err: unknown) {
            toastError('Invite Failed', err instanceof Error ? err.message : 'Failed to send invite');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: string) => {
        setOpenMenu(null);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || data.error || 'Role change failed');
            }
            toastSuccess('Role Updated', `Member role changed to ${newRole}`);
            fetchMembers();
        } catch (err: unknown) {
            toastError('Update Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        setConfirmRemove(null);
        setOpenMenu(null);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || data.error || 'Remove failed');
            }
            toastSuccess('Member Removed', 'The member has been removed from this workspace.');
            fetchMembers();
        } catch (err: unknown) {
            toastError('Remove Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const handleRevokeInvitation = async (invitationId: string) => {
        try {
            const res = await csrfFetch(`/api/invitations/${invitationId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Revoke failed');
            toastSuccess('Invitation Revoked', 'The invitation has been cancelled.');
            fetchInvitations();
        } catch (err: unknown) {
            toastError('Revoke Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">Access Denied</h3>
                <p className="text-slate-400">{error}</p>
            </div>
        );
    }

    const sortedMembers = [...members].sort((a, b) => {
        const roles = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };
        return roles[b.role] - roles[a.role];
    });

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
                            Team Members
                            <span className="text-sm px-2.5 py-0.5 rounded-full bg-nerve/10 text-nerve font-medium">
                                {members.length}
                            </span>
                        </h1>
                        <p className="text-slate-400">Manage who has access to this workspace and their roles</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { fetchMembers(); fetchInvitations(); }}
                            className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-800/50 transition">
                            <RefreshCw size={14} />
                        </button>
                        <button type="button" onClick={() => setIsInviteModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-nerve text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all hover:shadow-lg hover:shadow-nerve/20">
                            <UserPlus className="w-4 h-4" />
                            Invite Member
                        </button>
                    </div>
                </div>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
                    <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-2">
                        <Clock size={14} className="text-amber-400" />
                        <span className="text-sm font-semibold text-foreground">Pending Invitations</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
                            {invitations.length}
                        </span>
                    </div>
                    <div className="divide-y divide-slate-800/50">
                        {invitations.map(inv => (
                            <div key={inv.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-800/20 transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                                        <Mail size={14} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{inv.email}</p>
                                        <p className="text-xs text-slate-500">
                                            Invited by {inv.inviter?.name || inv.inviter?.email || 'Unknown'}
                                            {' • '}Expires {new Date(inv.expiresAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${roleConfig[inv.role]?.color || roleConfig.VIEWER.color}`}>
                                        {inv.role}
                                    </span>
                                    <button onClick={() => handleRevokeInvitation(inv.id)}
                                        className="text-xs text-slate-500 hover:text-red-400 px-2 py-1 transition">
                                        Revoke
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Member List */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden overflow-x-auto backdrop-blur-sm">
                <table className="w-full min-w-[640px] text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 tracking-wider">
                            <th className="px-6 py-4 pb-3 w-1/2">User</th>
                            <th className="px-6 py-4 pb-3">Role</th>
                            <th className="px-6 py-4 pb-3">Joined</th>
                            <th className="px-6 py-4 pb-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {sortedMembers.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-800/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-medium text-slate-300 shrink-0">
                                            {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground text-sm">
                                                {member.user.name || 'Unknown User'}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {member.user.email}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${roleConfig[member.role]?.color || roleConfig.VIEWER.color}`}>
                                        {member.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-400">
                                    {new Date(member.joinedAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {member.role !== 'OWNER' && (
                                        <div className="relative inline-block">
                                            <button onClick={() => setOpenMenu(openMenu === member.id ? null : member.id)}
                                                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-foreground transition opacity-0 group-hover:opacity-100">
                                                <MoreHorizontal size={16} />
                                            </button>
                                            {openMenu === member.id && (
                                                <div className="absolute right-0 top-full mt-1 z-20 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 w-48">
                                                    <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Change Role</p>
                                                    {(['ADMIN', 'MEMBER', 'VIEWER'] as const).filter(r => r !== member.role).map(role => (
                                                        <button key={role} onClick={() => handleRoleChange(member.id, role)}
                                                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-foreground flex items-center gap-2 transition">
                                                            <ChevronDown size={12} className="text-slate-600" />
                                                            Set as {role.charAt(0) + role.slice(1).toLowerCase()}
                                                        </button>
                                                    ))}
                                                    <div className="border-t border-slate-800 my-1" />
                                                    {confirmRemove === member.id ? (
                                                        <div className="px-3 py-2">
                                                            <p className="text-xs text-red-400 mb-2">Remove this member?</p>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => handleRemoveMember(member.id)}
                                                                    className="flex-1 text-xs bg-red-500/20 text-red-400 rounded px-2 py-1 hover:bg-red-500/30 transition">
                                                                    Confirm
                                                                </button>
                                                                <button onClick={() => setConfirmRemove(null)}
                                                                    className="flex-1 text-xs bg-slate-800 text-slate-400 rounded px-2 py-1 hover:bg-slate-700 transition">
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setConfirmRemove(member.id)}
                                                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition">
                                                            <Trash2 size={12} />
                                                            Remove Member
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-nerve/10 flex items-center justify-center text-nerve">
                                <Mail className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Invite Teammate</h2>
                                <p className="text-xs text-slate-400">They will receive an email link to join</p>
                            </div>
                        </div>

                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                                <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="w-full bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-nerve/50" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Assign Role</label>
                                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')}
                                    className="w-full bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-nerve/50 appearance-none">
                                    <option value="VIEWER">Viewer (Read-only access)</option>
                                    <option value="MEMBER">Member (Can manage assets)</option>
                                    <option value="ADMIN">Admin (Full access except billing)</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setIsInviteModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting}
                                    className="px-6 py-2 bg-nerve hover:brightness-110 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50">
                                    {isSubmitting ? 'Sending...' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
