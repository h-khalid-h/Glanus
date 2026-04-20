'use client';

/**
 * RBACProvider
 *
 * Hydrates the Zustand RBAC store whenever the NextAuth session changes.
 * Fetches /api/auth/me once per session and derives workspace permission
 * sets from each workspace's role using ROLE_PERMISSIONS.
 *
 * Mount this component inside <SessionProvider> and above any component
 * that calls useCan() or can().
 *
 * The store is persisted in localStorage (via Zustand persist middleware),
 * so stale data is available immediately on page refresh — this provider
 * refreshes it in the background.
 */

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/stores/authStore';
import { deriveWorkspacePermissions, ROLE_PERMISSIONS } from '@/utils/rbac';
import type { RBACUser } from '@/stores/authStore';

// Shape returned by GET /api/auth/me
interface MeResponse {
    user: {
        id: string;
        email: string;
        name: string | null;
        isStaff: boolean;
    };
    workspaces: Array<{
        id: string;
        name: string;
        role: string;        // 'OWNER' | 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER'
        slug: string;
    }>;
    /** Dynamic platform permission keys (resource.action format). */
    dynamicPermissions?: string[];
    /** Workspace-scoped dynamic permissions: { [workspaceId]: string[] } */
    workspaceDynamicPermissions?: Record<string, string[]>;
}

export function RBACProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const { setUser, setActiveWorkspace, logout } = useAuthStore();

    // Track the last session user ID so we only re-fetch when the user changes,
    // not on every unrelated session re-render.
    const lastHydratedUserId = useRef<string | null>(null);

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            logout();
            lastHydratedUserId.current = null;
            return;
        }

        const sessionUserId = session?.user?.id;
        if (!sessionUserId) return;

        // Skip re-hydration if already hydrated for this user
        if (lastHydratedUserId.current === sessionUserId) return;

        async function hydrate() {
            try {
                const res = await fetch('/api/auth/me', { credentials: 'include' });
                if (!res.ok) return;

                const json = await res.json();
                const data: MeResponse = json.data ?? json;

                const rbacUser: RBACUser = {
                    id: data.user.id,
                    // Super admins get the 'super_admin' role which bypasses all checks
                    roles: data.user.isStaff ? ['super_admin'] : [],
                    // Global permissions: super admins get all, regular users get none
                    // (workspace context is required for workspace-scoped permissions)
                    permissions: data.user.isStaff
                        ? (ROLE_PERMISSIONS['SUPER_ADMIN'] ?? [])
                        : [],
                    // Dynamic platform permission keys from the permission graph
                    dynamicPermissions: data.dynamicPermissions ?? [],
                    workspaces: data.workspaces.map((w) => ({
                        id: w.id,
                        name: w.name,
                        role: w.role,
                        // When the user owns the workspace, ownerId === user.id.
                        // For non-owned workspaces the owner ID is not in the /me
                        // response; we leave it empty — full access is still provided
                        // by the OWNER role entry in ROLE_PERMISSIONS.
                        ownerId: w.role === 'OWNER' ? data.user.id : '',
                        permissions: deriveWorkspacePermissions(w.role),
                        // Dynamic workspace permission keys from custom roles
                        dynamicPermissions: data.workspaceDynamicPermissions?.[w.id] ?? [],
                    })),
                };

                setUser(rbacUser);
                lastHydratedUserId.current = data.user.id;

                // Sync activeWorkspaceId with whatever WorkspaceContext is storing.
                // WorkspaceContext persists the active workspace under 'currentWorkspaceId'.
                const storedWid = localStorage.getItem('currentWorkspaceId');
                const resolvedWid =
                    storedWid && rbacUser.workspaces.some((w) => w.id === storedWid)
                        ? storedWid
                        : rbacUser.workspaces[0]?.id ?? null;

                if (resolvedWid) {
                    setActiveWorkspace(resolvedWid);
                }
            } catch {
                // Silent — auth store keeps its persisted state as fallback
            }
        }

        hydrate();
    }, [status, session?.user?.id, setUser, setActiveWorkspace, logout]);

    return <>{children}</>;
}
