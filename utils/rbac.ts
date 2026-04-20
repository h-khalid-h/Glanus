/**
 * RBAC core utilities — UI permission checking.
 *
 * IMPORTANT: This is for UX only. The backend enforces all real
 * access control. These helpers determine what UI elements to show
 * or which routes to redirect from.
 *
 * Performance: can() never makes API calls. It reads Zustand state
 * synchronously (O(1) permission set lookups).
 */

import type { RBACUser } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Permission constants
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
    // Workspace visibility
    VIEW_WORKSPACE:      'view_workspace',
    VIEW_ANALYTICS:      'view_analytics',
    VIEW_REPORTS:        'view_reports',

    // Assets
    CREATE_ASSET:        'create_asset',
    EDIT_ASSET:          'edit_asset',
    DELETE_ASSET:        'delete_asset',
    MANAGE_ASSETS:       'manage_assets',

    // Alerts
    MANAGE_ALERTS:       'manage_alerts',

    // Team / users
    VIEW_USERS:          'view_users',
    INVITE_MEMBERS:      'invite_members',
    REMOVE_MEMBERS:      'remove_members',

    // Workspace administration
    MANAGE_WORKSPACE:    'manage_workspace',
    MANAGE_INTEGRATIONS: 'manage_integrations',
    MANAGE_BILLING:      'manage_billing',
    DELETE_WORKSPACE:    'delete_workspace',

    // Platform super-admin
    SUPER_ADMIN_ACCESS:  'super_admin_access',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ---------------------------------------------------------------------------
// Role → permission derivation
// Used by RBACProvider to pre-compute workspace permission sets.
// ---------------------------------------------------------------------------

const VIEWER_PERMS: Permission[] = [
    PERMISSIONS.VIEW_WORKSPACE,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_REPORTS,
];

const MEMBER_PERMS: Permission[] = [
    ...VIEWER_PERMS,
    PERMISSIONS.CREATE_ASSET,
    PERMISSIONS.EDIT_ASSET,
    PERMISSIONS.MANAGE_ASSETS,
];

const STAFF_PERMS: Permission[] = [
    ...MEMBER_PERMS,
    PERMISSIONS.DELETE_ASSET,
    PERMISSIONS.MANAGE_ALERTS,
    PERMISSIONS.VIEW_USERS,
];

const ADMIN_PERMS: Permission[] = [
    ...STAFF_PERMS,
    PERMISSIONS.INVITE_MEMBERS,
    PERMISSIONS.REMOVE_MEMBERS,
    PERMISSIONS.MANAGE_WORKSPACE,
    PERMISSIONS.MANAGE_INTEGRATIONS,
];

const OWNER_PERMS: Permission[] = [
    ...ADMIN_PERMS,
    PERMISSIONS.MANAGE_BILLING,
    PERMISSIONS.DELETE_WORKSPACE,
];

const SUPER_ADMIN_PERMS: Permission[] = [
    ...OWNER_PERMS,
    PERMISSIONS.SUPER_ADMIN_ACCESS,
];

/**
 * Maps a workspace role (or SUPER_ADMIN) to its permission set.
 * Pass the result as `permissions` when building RBACWorkspace entries.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    VIEWER:      VIEWER_PERMS,
    MEMBER:      MEMBER_PERMS,
    STAFF:       STAFF_PERMS,
    ADMIN:       ADMIN_PERMS,
    OWNER:       OWNER_PERMS,
    SUPER_ADMIN: SUPER_ADMIN_PERMS,
};

/**
 * Derives the permission array for a given workspace role string.
 * Returns an empty array for unknown roles (fail-safe).
 */
export function deriveWorkspacePermissions(role: string): Permission[] {
    return ROLE_PERMISSIONS[role] ?? [];
}

// ---------------------------------------------------------------------------
// Core permission check — pure function (no React, no network)
// ---------------------------------------------------------------------------

/**
 * Checks whether `user` has `permission` in the context of `workspaceId`.
 *
 * Evaluation order (mirrors spec):
 * 1. No user → false
 * 2. Super admin (roles includes 'super_admin') → true
 * 3. Workspace context:
 *    a. Workspace not found → false
 *    b. Workspace owner override (ownerId === user.id) → true
 *    c. workspace.permissions includes permission → true
 * 4. user.permissions (global) includes permission → true
 * 5. No workspace context but not super admin → false
 */
export function canUser(
    user: RBACUser | null,
    permission: string,
    workspaceId?: string | null,
): boolean {
    // 1. No user
    if (!user) return false;

    // 2. Super admin bypass
    if (user.roles.includes('super_admin')) return true;

    // Resolve workspace context
    const wid = workspaceId ?? null;

    if (wid) {
        const workspace = user.workspaces.find((w) => w.id === wid);

        // 3a. User is not in this workspace
        if (!workspace) return false;

        // 3b. Owner always has full access
        if (workspace.ownerId && workspace.ownerId === user.id) return true;

        // 3c. Workspace-scoped permission
        if (workspace.permissions.includes(permission)) return true;

        return false;
    }

    // 4. Global (non-workspace-scoped) permission
    if (user.permissions.includes(permission)) return true;

    // 5. No context, no access
    return false;
}

// ---------------------------------------------------------------------------
// Store-aware wrapper — reads from Zustand (safe to call outside React)
// ---------------------------------------------------------------------------

/**
 * can(permission, workspaceId?)
 *
 * Store-aware permission check. Falls back to activeWorkspaceId when
 * workspaceId is not provided.
 *
 * Can be called outside React components (e.g. in event handlers or
 * utilities) because it reads Zustand state via getState().
 *
 * @example
 *   if (can(PERMISSIONS.INVITE_MEMBERS, workspaceId)) { ... }
 */
export function can(permission: string, workspaceId?: string | null): boolean {
    // Lazy import to avoid circular dependency at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require('@/stores/authStore') as typeof import('@/stores/authStore');
    const { user, activeWorkspaceId } = useAuthStore.getState();

    const resolvedWorkspaceId = workspaceId ?? activeWorkspaceId;
    return canUser(user, permission, resolvedWorkspaceId);
}
