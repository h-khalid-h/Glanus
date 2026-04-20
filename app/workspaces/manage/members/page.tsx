'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationMeta } from '@/components/ui/Pagination';
import {
    UserPlus, ShieldAlert, Mail, Clock,
    Trash2, RefreshCw, ShieldCheck, Eye, Users,
    Edit2, KeyRound, Copy, Check, X,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface Member {
    id: string;
    userId: string;
    role: 'OWNER' | 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER';
    joinedAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        isActive: boolean;
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

interface EditMemberForm {
    name: string;
    email: string;
    role: 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER';
    isActive: boolean;
}

const roleConfig: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
    OWNER: { label: 'Owner', color: 'bg-health-good/10 text-health-good border-health-good/20', icon: ShieldAlert },
    ADMIN: { label: 'Admin', color: 'bg-primary/10 text-primary border-primary/20', icon: ShieldCheck },
    STAFF: { label: 'Staff', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Users },
    MEMBER: { label: 'Member', color: 'bg-cortex/10 text-cortex border-cortex/20', icon: Users },
    VIEWER: { label: 'Viewer', color: 'bg-muted text-foreground border-border', icon: Eye },
};

/* ─── Active-status badge ─────────────────────────────────────────────────── */
function ActiveBadge({ isActive }: { isActive: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${isActive
            ? 'bg-health-good/10 text-health-good border-health-good/20'
            : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-health-good' : 'bg-destructive'}`} />
            {isActive ? 'Active' : 'Inactive'}
        </span>
    );
}

/* ─── Toggle Switch ───────────────────────────────────────────────────────── */
function ToggleSwitch({ checked, onChange, disabled }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                checked ? 'bg-health-good' : 'bg-muted-foreground/30',
            ].join(' ')}
        >
            <span className={[
                'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
                checked ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')} />
        </button>
    );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function WorkspaceMembersPage() {
    const workspaceId = useWorkspaceId();
    const { success: toastSuccess, error: toastError } = useToast();
    const { user: currentUser } = useAuth();

    const [members, setMembers] = useState<Member[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });

    // Invite modal
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER'>('VIEWER');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Remove confirmation
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

    // Edit modal
    const [editMember, setEditMember] = useState<Member | null>(null);
    const [editForm, setEditForm] = useState<EditMemberForm>({ name: '', email: '', role: 'MEMBER', isActive: true });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Reset password modal
    const [resetTarget, setResetTarget] = useState<Member | null>(null);
    const [resetCustomPw, setResetCustomPw] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [tempPassword, setTempPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Per-row toggle-active loading
    const [togglingActive, setTogglingActive] = useState<Set<string>>(new Set());

    const fetchMembers = useCallback(async (page = 1) => {
        if (!workspaceId) return;
        try {
            setIsLoading(true);
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/members?page=${page}&limit=20`);
            if (!res.ok) throw new Error('Failed to load members');
            const data = await res.json();
            setMembers(data.data?.members || data.members || []);
            if (data.data?.pagination) setPagination(data.data.pagination);
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
            if (!res.ok) return;
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

    /* ── Invite ── */
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

    /* ── Remove ── */
    const handleRemoveMember = async (memberId: string) => {
        setConfirmRemove(null);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/members/${memberId}`, { method: 'DELETE' });
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

    /* ── Open edit modal ── */
    const openEditModal = (member: Member) => {
        setEditMember(member);
        setEditForm({
            name: member.user.name ?? '',
            email: member.user.email,
            role: member.role as 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER',
            isActive: member.user.isActive,
        });
    };

    /* ── Submit edit ── */
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editMember) return;
        setIsSavingEdit(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/members/${editMember.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name || undefined,
                    email: editForm.email !== editMember.user.email ? editForm.email : undefined,
                    role: editForm.role !== editMember.role ? editForm.role : undefined,
                    isActive: editForm.isActive !== editMember.user.isActive ? editForm.isActive : undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || data.error || 'Update failed');
            }
            toastSuccess('Member Updated', 'Member details have been saved.');
            setEditMember(null);
            fetchMembers();
        } catch (err: unknown) {
            toastError('Update Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsSavingEdit(false);
        }
    };

    /* ── Toggle active (inline) ── */
    const handleToggleActive = async (member: Member) => {
        if (member.userId === currentUser?.id) {
            toastError('Not Allowed', 'You cannot deactivate your own account.');
            return;
        }
        const newValue = !member.user.isActive;
        // Optimistic update
        setMembers(prev => prev.map(m =>
            m.id === member.id ? { ...m, user: { ...m.user, isActive: newValue } } : m,
        ));
        setTogglingActive(prev => new Set([...prev, member.id]));
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/members/${member.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: newValue }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || 'Toggle failed');
            }
            toastSuccess(newValue ? 'Member Activated' : 'Member Deactivated',
                `${member.user.name || member.user.email} is now ${newValue ? 'active' : 'inactive'}.`);
        } catch (err: unknown) {
            // Rollback
            setMembers(prev => prev.map(m =>
                m.id === member.id ? { ...m, user: { ...m.user, isActive: !newValue } } : m,
            ));
            toastError('Toggle Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setTogglingActive(prev => { const s = new Set(prev); s.delete(member.id); return s; });
        }
    };

    /* ── Reset password ── */
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetTarget) return;
        setIsResetting(true);
        try {
            const body: Record<string, string> = {};
            if (resetCustomPw) body.password = resetCustomPw;
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/members/${resetTarget.id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || 'Reset failed');
            }
            const data = await res.json();
            setTempPassword(data.data?.temporaryPassword ?? data.temporaryPassword ?? null);
            setResetCustomPw('');
        } catch (err: unknown) {
            toastError('Reset Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsResetting(false);
        }
    };

    const handleCopyPassword = () => {
        if (!tempPassword) return;
        navigator.clipboard.writeText(tempPassword).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const closeResetModal = () => {
        setResetTarget(null);
        setTempPassword(null);
        setResetCustomPw('');
        setCopied(false);
    };

    /* ── Invitations ── */
    const handleRevokeInvitation = async (invitationId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Revoke failed');
            toastSuccess('Invitation Revoked', 'The invitation has been cancelled.');
            fetchInvitations();
        } catch (err: unknown) {
            toastError('Revoke Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const handleResendInvitation = async (invitationId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}/resend`, { method: 'POST' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || 'Resend failed');
            }
            toastSuccess('Invitation Resent', 'A new invitation email has been sent.');
            fetchInvitations();
        } catch (err: unknown) {
            toastError('Resend Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    /* ── Loading skeleton ── */
    if (isLoading) {
        return (
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="h-8 w-64 animate-pulse rounded-xl bg-surface-2" />
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
                <p className="text-muted-foreground">{error}</p>
            </div>
        );
    }

    const sortedMembers = [...members].sort((a, b) => {
        const roles: Record<string, number> = { OWNER: 5, ADMIN: 4, STAFF: 3, MEMBER: 2, VIEWER: 1 };
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
                            <span className="text-sm px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {members.length}
                            </span>
                        </h1>
                        <p className="text-muted-foreground">Manage who has access to this workspace and their roles</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { fetchMembers(); fetchInvitations(); }}
                            className="flex items-center gap-1.5 px-3 py-2.5 border border-border text-foreground rounded-xl text-sm hover:bg-muted/50 transition">
                            <RefreshCw size={14} />
                        </button>
                        <button type="button" onClick={() => setIsInviteModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all hover:shadow-lg hover:shadow-primary/20">
                            <UserPlus className="w-4 h-4" />
                            Invite Member
                        </button>
                    </div>
                </div>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <div className="mb-6 bg-card border border-border rounded-xl overflow-hidden backdrop-blur-sm">
                    <div className="px-6 py-3 border-b border-border flex items-center gap-2">
                        <Clock size={14} className="text-warning" />
                        <span className="text-sm font-semibold text-foreground">Pending Invitations</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-warning font-medium">
                            {invitations.length}
                        </span>
                    </div>
                    <div className="divide-y divide-border/50">
                        {invitations.map(inv => (
                            <div key={inv.id} className="px-6 py-3 flex items-center justify-between hover:bg-muted/20 transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-warning">
                                        <Mail size={14} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{inv.email}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Invited by {inv.inviter?.name || inv.inviter?.email || 'Unknown'}
                                            {' • '}Expires {new Date(inv.expiresAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${roleConfig[inv.role]?.color || roleConfig.VIEWER.color}`}>
                                        {inv.role}
                                    </span>
                                    <button onClick={() => handleResendInvitation(inv.id)}
                                        className="text-xs text-muted-foreground hover:text-primary px-2 py-1 transition">
                                        Resend
                                    </button>
                                    <button onClick={() => handleRevokeInvitation(inv.id)}
                                        className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 transition">
                                        Revoke
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Member List */}
            <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto backdrop-blur-sm">
                <table className="w-full min-w-[720px] text-left border-collapse">
                    <thead>
                        <tr className="border-b border-border text-xs font-semibold text-muted-foreground tracking-wider">
                            <th className="px-6 py-4 pb-3 w-[35%]">User</th>
                            <th className="px-6 py-4 pb-3">Role</th>
                            <th className="px-6 py-4 pb-3">Status</th>
                            <th className="px-6 py-4 pb-3">Joined</th>
                            <th className="px-6 py-4 pb-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {sortedMembers.map((member) => {
                            const isSelf = member.userId === currentUser?.id;
                            const isOwner = member.role === 'OWNER';
                            return (
                                <tr key={member.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={[
                                                'w-10 h-10 rounded-full flex items-center justify-center font-medium text-foreground shrink-0',
                                                member.user.isActive ? 'bg-muted' : 'bg-muted/40 opacity-60',
                                            ].join(' ')}>
                                                {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className={`font-medium text-sm ${member.user.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                                                    {member.user.name || 'Unknown User'}
                                                    {isSelf && <span className="ml-1.5 text-[10px] text-primary font-semibold not-italic no-underline">(you)</span>}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
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
                                    <td className="px-6 py-4">
                                        {isOwner ? (
                                            <ActiveBadge isActive={true} />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <ToggleSwitch
                                                    checked={member.user.isActive}
                                                    onChange={() => handleToggleActive(member)}
                                                    disabled={isSelf || togglingActive.has(member.id)}
                                                />
                                                <ActiveBadge isActive={member.user.isActive} />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">
                                        {new Date(member.joinedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {!isOwner && (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(member)}
                                                    title="Edit member"
                                                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                                                    <Edit2 className="h-3 w-3" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => { setResetTarget(member); setTempPassword(null); setResetCustomPw(''); }}
                                                    title="Reset password"
                                                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-warning hover:border-warning/40 hover:bg-warning/10 transition-colors">
                                                    <KeyRound className="h-3 w-3" />
                                                    Reset PW
                                                </button>
                                                {confirmRemove === member.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => handleRemoveMember(member.id)}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/20 transition-colors">
                                                            Confirm
                                                        </button>
                                                        <button onClick={() => setConfirmRemove(null)}
                                                            className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setConfirmRemove(member.id)}
                                                        title="Remove Member"
                                                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/20 transition-colors">
                                                        <Trash2 className="h-3 w-3" />
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Member Pagination */}
            <Pagination pagination={pagination} onPageChange={fetchMembers} noun="members" className="mt-4" />

            {/* ─── Invite Modal ──────────────────────────────────────────────────── */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface-1 border border-border rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Mail className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Invite Teammate</h2>
                                <p className="text-xs text-muted-foreground">They will receive an email link to join</p>
                            </div>
                        </div>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
                                <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="w-full bg-muted border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Assign Role</label>
                                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER')}
                                    className="role-select appearance-none">
                                    <option value="VIEWER">Viewer (Read-only access)</option>
                                    <option value="MEMBER">Member (Can manage assets)</option>
                                    <option value="STAFF">Staff (Day-to-day operations)</option>
                                    <option value="ADMIN">Admin (Full access except billing)</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setIsInviteModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-foreground hover:text-foreground transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting}
                                    className="px-6 py-2 bg-primary hover:brightness-110 text-foreground text-sm font-medium rounded-xl transition-all disabled:opacity-50">
                                    {isSubmitting ? 'Sending...' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Edit Member Modal ─────────────────────────────────────────────── */}
            {editMember && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface-1 border border-border rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <Edit2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Edit Member</h2>
                                    <p className="text-xs text-muted-foreground">{editMember.user.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setEditMember(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="John Smith"
                                    className="w-full bg-muted border border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={editForm.email}
                                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full bg-muted border border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
                                <select
                                    value={editForm.role}
                                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value as EditMemberForm['role'] }))}
                                    className="role-select appearance-none">
                                    <option value="VIEWER">Viewer</option>
                                    <option value="MEMBER">Member</option>
                                    <option value="STAFF">Staff</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Active Account</p>
                                    <p className="text-xs text-muted-foreground">Inactive users cannot sign in</p>
                                </div>
                                <ToggleSwitch
                                    checked={editForm.isActive}
                                    onChange={v => setEditForm(f => ({ ...f, isActive: v }))}
                                    disabled={editMember.userId === currentUser?.id}
                                />
                            </div>
                            {editMember.userId === currentUser?.id && (
                                <p className="text-xs text-warning">You cannot deactivate your own account.</p>
                            )}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setEditMember(null)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSavingEdit}
                                    className="px-6 py-2 bg-primary hover:brightness-110 text-foreground text-sm font-medium rounded-xl transition-all disabled:opacity-50">
                                    {isSavingEdit ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Reset Password Modal ──────────────────────────────────────────── */}
            {resetTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface-1 border border-border rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                                    <KeyRound className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Reset Password</h2>
                                    <p className="text-xs text-muted-foreground">{resetTarget.user.email}</p>
                                </div>
                            </div>
                            <button onClick={closeResetModal} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {tempPassword ? (
                            /* ── Success: show temporary password ── */
                            <div className="space-y-4">
                                <div className="rounded-xl border border-health-good/30 bg-health-good/5 p-4">
                                    <p className="text-sm text-health-good font-semibold mb-1">Password Reset Successfully</p>
                                    <p className="text-xs text-muted-foreground">
                                        Share this temporary password with the user. They will be prompted to change it on next login.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Temporary Password</label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm font-mono text-foreground border border-border select-all">
                                            {tempPassword}
                                        </code>
                                        <button
                                            type="button"
                                            onClick={handleCopyPassword}
                                            title="Copy to clipboard"
                                            className={[
                                                'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                                                copied
                                                    ? 'border-health-good/40 bg-health-good/10 text-health-good'
                                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                            ].join(' ')}>
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                            {copied ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    This password will not be shown again after you close this dialog.
                                </p>
                                <button
                                    type="button"
                                    onClick={closeResetModal}
                                    className="w-full px-4 py-2.5 bg-primary hover:brightness-110 text-foreground text-sm font-medium rounded-xl transition-all">
                                    Done
                                </button>
                            </div>
                        ) : (
                            /* ── Confirmation form ── */
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Are you sure you want to reset the password for{' '}
                                    <span className="font-semibold text-foreground">{resetTarget.user.name || resetTarget.user.email}</span>?
                                    A temporary password will be generated.
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">
                                        Custom Password <span className="text-muted-foreground font-normal">(optional)</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={resetCustomPw}
                                        onChange={e => setResetCustomPw(e.target.value)}
                                        placeholder="Leave blank to auto-generate"
                                        minLength={8}
                                        className="w-full bg-muted border border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    {resetCustomPw && resetCustomPw.length < 8 && (
                                        <p className="text-xs text-destructive mt-1">Must be at least 8 characters.</p>
                                    )}
                                </div>
                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button type="button" onClick={closeResetModal}
                                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isResetting || (!!resetCustomPw && resetCustomPw.length < 8)}
                                        className="px-6 py-2 bg-warning hover:brightness-110 text-black text-sm font-medium rounded-xl transition-all disabled:opacity-50">
                                        {isResetting ? 'Resetting…' : 'Reset Password'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
