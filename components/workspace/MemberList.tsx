'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { Button } from '@/components/ui/Button';
import { UserMinus, Shield, ShieldAlert, User, MoreVertical, Users } from 'lucide-react';
import { clsx } from 'clsx';
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
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const { currentWorkspace } = useWorkspaceStore();
    const { error: showError } = useToast();
    const menuRef = useRef<HTMLDivElement>(null);
    const [confirmState, setConfirmState] = useState<{ open: boolean; memberId: string | null }>({
        open: false,
        memberId: null,
    });

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpenMenuId(null);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

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
    }, [workspaceId]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const handleUpdateRole = async (memberId: string, newRole: string) => {
        setOpenMenuId(null);
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
        setOpenMenuId(null);
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
        return <div className="text-center py-8 text-slate-500">Loading members...</div>;
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
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl shadow-sm border border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-white">Team Members</h3>
                    <span className="text-sm text-slate-500">{members.length} members</span>
                </div>

                <div className="divide-y divide-slate-800">
                    {members.map((member) => (
                        <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/40/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-nerve/15/30 flex items-center justify-center text-nerve font-medium text-sm">
                                    {member.user.name ? member.user.name.charAt(0).toUpperCase() : member.user.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">
                                        {member.user.name || 'Unnamed User'}
                                        {currentWorkspace?.id === workspaceId && member.role === 'OWNER' && (
                                            <span className="ml-2 text-xs font-normal text-slate-400">(Owner)</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500">{member.user.email}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Badge variant={member.role === 'OWNER' ? 'primary' : 'info'}>
                                    {member.role}
                                </Badge>

                                {canManage && member.role !== 'OWNER' && (
                                    <div className="relative" ref={openMenuId === member.id ? menuRef : undefined}>
                                        <button type="button"
                                            onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                                            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                                            aria-expanded={openMenuId === member.id}
                                            aria-haspopup="true"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {openMenuId === member.id && (
                                            <div
                                                className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-slate-700 rounded-md bg-slate-900/50 backdrop-blur-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10 animate-in fade-in zoom-in-95 duration-100"
                                                role="menu"
                                            >
                                                <div className="px-1 py-1">
                                                    <button type="button"
                                                        onClick={() => handleUpdateRole(member.id, 'ADMIN')}
                                                        className="group flex w-full items-center rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-nerve/10 hover:text-nerve transition-colors"
                                                        role="menuitem"
                                                    >
                                                        <ShieldAlert className="mr-2 h-4 w-4" />
                                                        Make Admin
                                                    </button>
                                                    <button type="button"
                                                        onClick={() => handleUpdateRole(member.id, 'MEMBER')}
                                                        className="group flex w-full items-center rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-nerve/10 hover:text-nerve transition-colors"
                                                        role="menuitem"
                                                    >
                                                        <User className="mr-2 h-4 w-4" />
                                                        Make Member
                                                    </button>
                                                </div>
                                                <div className="px-1 py-1">
                                                    <button type="button"
                                                        onClick={() => requestRemove(member.id)}
                                                        className="group flex w-full items-center rounded-md px-2 py-2 text-sm text-health-critical hover:bg-health-critical/10 transition-colors"
                                                        role="menuitem"
                                                    >
                                                        <UserMinus className="mr-2 h-4 w-4" />
                                                        Remove Member
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {members.length === 0 && (
                        <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/10 m-6">
                            <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                                <Users className="w-6 h-6 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No team members</h3>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                You haven't added anyone to this workspace yet. Invite people to collaborate.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
