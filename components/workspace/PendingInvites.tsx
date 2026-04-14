'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { Trash2, RefreshCw, Mail } from 'lucide-react';
import { Badge, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/lib/toast';

interface Invitation {
    id: string;
    email: string;
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
    inviter: {
        name: string | null;
        email: string;
    };
    createdAt: string;
    expiresAt: string;
}

export default function PendingInvites({ workspaceId }: { workspaceId: string }) {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { currentWorkspace } = useWorkspaceStore();
    const { error: showError, success: showSuccess } = useToast();
    const [confirmState, setConfirmState] = useState<{ open: boolean; inviteId: string | null }>({
        open: false,
        inviteId: null,
    });

    const fetchInvitations = useCallback(async () => {
        try {
            const response = await csrfFetch(`/api/workspaces/${workspaceId}/invitations`);
            if (response.ok) {
                const data = await response.json();
                setInvitations(data.invitations);
            }
        } catch {
            showError('Load Failed', 'Could not load pending invitations.');
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchInvitations();

        // Listen for custom event to refresh list (triggered by InviteForm)
        const handleRefresh = () => fetchInvitations();
        window.addEventListener('refresh-invitations', handleRefresh);
        return () => window.removeEventListener('refresh-invitations', handleRefresh);
    }, [fetchInvitations]);

    const requestRevoke = (inviteId: string) => {
        setConfirmState({ open: true, inviteId });
    };

    const handleRevoke = async () => {
        const inviteId = confirmState.inviteId;
        setConfirmState({ open: false, inviteId: null });
        if (!inviteId) return;

        setActionLoading(inviteId);
        try {
            await csrfFetch(`/api/workspaces/${workspaceId}/invitations/${inviteId}`, {
                method: 'DELETE',
            });
            await fetchInvitations();
        } catch {
            showError('Revoke Failed', 'Could not revoke invitation.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleResend = async (invite: Invitation) => {
        setActionLoading(invite.id);
        try {
            // Revoke the existing invitation
            await csrfFetch(`/api/workspaces/${workspaceId}/invitations/${invite.id}`, {
                method: 'DELETE',
            });

            // Re-create with same email and role (sends a fresh email)
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: invite.email, role: invite.role }),
            });

            if (res.ok) {
                showSuccess('Invitation Resent', `Fresh invitation sent to ${invite.email}`);
                await fetchInvitations();
            } else {
                const data = await res.json();
                showError('Resend Failed', data.error || 'Could not resend invitation.');
            }
        } catch {
            showError('Resend Failed', 'Could not resend invitation.');
        } finally {
            setActionLoading(null);
        }
    };

    const currentRole = currentWorkspace?.userRole;
    const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN';

    if (isLoading) return null;

    const confirmDialog = (
        <ConfirmDialog
            open={confirmState.open}
            title="Revoke Invitation"
            message="Are you sure you want to revoke this invitation? The recipient will no longer be able to join."
            confirmLabel="Revoke"
            variant="danger"
            onConfirm={handleRevoke}
            onCancel={() => setConfirmState({ open: false, inviteId: null })}
        />
    );
    if (invitations.length === 0) return null;

    return (
        <>
            {confirmDialog}
            <div className="bg-card backdrop-blur-sm rounded-xl shadow-sm border border-border overflow-hidden mt-8">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-lg font-medium text-foreground">Pending Invitations</h3>
                </div>

                <div className="divide-y divide-border">
                    {invitations.map((invite) => (
                        <div key={invite.id} className="px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-foreground">
                                        {invite.email}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Invited by {invite.inviter.name || invite.inviter.email} • Expires {new Date(invite.expiresAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Badge variant="info" className="uppercase text-[10px]">
                                    {invite.role}
                                </Badge>

                                {canManage && (
                                    <>
                                        <button type="button"
                                            onClick={() => handleResend(invite)}
                                            disabled={!!actionLoading}
                                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary hover:text-primary transition-colors"
                                            title="Resend Invitation"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                        <button type="button"
                                            onClick={() => requestRevoke(invite.id)}
                                            disabled={!!actionLoading}
                                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            title="Revoke Invitation"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
