'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { UserMinus, ShieldAlert, User, Users } from 'lucide-react';
import { Badge, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/lib/toast';

interface Member {
    id: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    user: {
        id: string;
        name: string | null;
        email: string;
    };
}

export default function MemberList({ workspaceId }: { workspaceId: string }) {
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [_actionLoading, setActionLoading] = useState<string | null>(null);
    const { currentWorkspace } = useWorkspaceStore();
    const { error: showError } = useToast();
    const [confirmState, setConfirmState] = useState<{ open: boolean; memberId: string | null }>({
        open: false,
        memberId: null,
    });

    const fetchMembers = useCallback(async () => {
        try {
            const response = await csrfFetch(`/api/workspaces/${workspaceId}/members`);
            if (response.ok) {
                const result = await response.json();
                setMembers(result.data?.members || []);
            }
        } catch {
            showError('Load Failed', 'Could not load team members.');
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const handleUpdateRole = async (memberId: string, newRole: string) => {
        setActionLoading(memberId);
        try {
            await csrfFetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            await fetchMembers();
        } catch {
            showError('Update Failed', 'Could not update member role.');
        } finally {
            setActionLoading(null);
        }
    };

    const requestRemove = (memberId: string) => {
        setConfirmState({ open: true, memberId });
    };

    const handleRemoveMember = async () => {
        const memberId = confirmState.memberId;
        setConfirmState({ open: false, memberId: null });
        if (!memberId) return;

        setActionLoading(memberId);
        try {
            await csrfFetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
                method: 'DELETE',
            });
            await fetchMembers();
        } catch {
            showError('Remove Failed', 'Could not remove team member.');
        } finally {
            setActionLoading(null);
        }
    };

    const currentRole = currentWorkspace?.userRole;
    const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN';

    if (isLoading) {
        return <div className="text-center py-8 text-muted-foreground">Loading members...</div>;
    }

    return (
        <>
            <ConfirmDialog
                open={confirmState.open}
                title="Remove Team Member"
                message="Are you sure you want to remove this member? They will lose access to all workspace resources."
                confirmLabel="Remove"
                variant="danger"
                onConfirm={handleRemoveMember}
                onCancel={() => setConfirmState({ open: false, memberId: null })}
            />
            <div className="bg-card backdrop-blur-sm rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                    <h3 className="text-lg font-medium text-foreground">Team Members</h3>
                    <span className="text-sm text-muted-foreground">{members.length} members</span>
                </div>

                <div className="divide-y divide-border">
                    {members.map((member) => (
                        <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-medium text-sm">
                                    {member.user.name ? member.user.name.charAt(0).toUpperCase() : member.user.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-foreground">
                                        {member.user.name || 'Unnamed User'}
                                        {currentWorkspace?.id === workspaceId && member.role === 'OWNER' && (
                                            <span className="ml-2 text-xs font-normal text-muted-foreground">(Owner)</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{member.user.email}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Badge variant={member.role === 'OWNER' ? 'primary' : 'info'}>
                                    {member.role}
                                </Badge>

                                {canManage && member.role !== 'OWNER' && (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateRole(member.id, 'ADMIN')}
                                            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
                                        >
                                            <ShieldAlert className="h-3.5 w-3.5" />
                                            Admin
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateRole(member.id, 'MEMBER')}
                                            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                        >
                                            <User className="h-3.5 w-3.5" />
                                            Member
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => requestRemove(member.id)}
                                            className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/15 transition-colors"
                                        >
                                            <UserMinus className="h-3.5 w-3.5" />
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {members.length === 0 && (
                        <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-border bg-surface-1/10 m-6">
                            <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                <Users className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground mb-2">No team members</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                You haven't added anyone to this workspace yet. Invite people to collaborate.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
