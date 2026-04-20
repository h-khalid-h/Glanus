/**
 * Zustand RBAC Auth Store
 *
 * Holds the authenticated user's identity and pre-computed workspace
 * permission sets. This is the single source of truth for all frontend
 * permission checks via can() and useCan().
 *
 * Security note: this store is UI-only. The backend always re-validates
 * every action. Never rely on this store for real security enforcement.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Workspace entry in the RBAC store.
// - ownerId is set to user.id when role === 'OWNER'; empty string otherwise.
// - permissions is derived from the workspace role via ROLE_PERMISSIONS.
// - dynamicPermissions contains resource.action keys from custom roles.
export interface RBACWorkspace {
    id: string;
    name: string;
    ownerId: string;
    role: string;
    permissions: string[];
    /** Dynamic permission keys (resource.action format) from custom workspace roles. */
    dynamicPermissions?: string[];
}

export interface RBACUser {
    id: string;
    /** Contains 'super_admin' if user.isStaff, otherwise empty. */
    roles: string[];
    /** Global (non-workspace-scoped) permissions, e.g. super_admin_access. */
    permissions: string[];
    /** Dynamic platform permission keys (resource.action format) from platform role. */
    dynamicPermissions?: string[];
    workspaces: RBACWorkspace[];
}

interface AuthState {
    /** Full RBAC user — null when logged out. */
    user: RBACUser | null;

    /**
     * Active workspace ID mirrors the workspace the user currently operates in.
     * Falls back to first workspace in user.workspaces when null.
     */
    activeWorkspaceId: string | null;

    setUser(user: RBACUser): void;
    setActiveWorkspace(id: string): void;
    logout(): void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            activeWorkspaceId: null,

            setUser: (user) => set({ user }),

            setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

            logout: () => set({ user: null, activeWorkspaceId: null }),
        }),
        {
            name: 'glanus-rbac',
            // Only persist serialisable state — functions are re-created by zustand
            partialize: (state) => ({
                user: state.user,
                activeWorkspaceId: state.activeWorkspaceId,
            }),
        },
    ),
);
