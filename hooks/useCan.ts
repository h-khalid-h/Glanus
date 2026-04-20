'use client';

/**
 * useCan — workspace-aware permission hook.
 *
 * Reads the RBAC store and returns a boolean that updates whenever the
 * user, active workspace, or permission set changes. Memoized to avoid
 * unnecessary re-renders.
 *
 * @example
 *   const canInvite = useCan(PERMISSIONS.INVITE_MEMBERS);
 *   const canDelete = useCan(PERMISSIONS.DELETE_WORKSPACE, workspaceId);
 */

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { canUser } from '@/utils/rbac';

export function useCan(
    permission: string,
    workspaceId?: string | null,
): boolean {
    const user = useAuthStore((state) => state.user);
    const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);

    return useMemo(() => {
        const resolvedWorkspaceId = workspaceId ?? activeWorkspaceId;
        return canUser(user, permission, resolvedWorkspaceId);
    }, [user, permission, workspaceId, activeWorkspaceId]);
}
