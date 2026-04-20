/**
 * Dynamic RBAC Permission Engine
 *
 * Provides the core `canAccess(user, resource, action, workspaceId?)` function
 * that resolves permissions from the DB-backed permission graph.
 *
 * This module bridges the legacy static PERMISSIONS constants with the new
 * dynamic Permission model. Both systems work in tandem:
 *   - Legacy: `can(PERMISSIONS.INVITE_MEMBERS)` — reads Zustand store
 *   - Dynamic: `canAccess(user, 'users', 'create', wid)` — reads permission graph
 *
 * The permission graph (UserPermissionGraph) is hydrated from DB and cached
 * in Redis with a 15-minute TTL.
 */

import type { UserPermissionGraph } from '@/lib/rbac/permissionCache';

// ---------------------------------------------------------------------------
// Default permission catalogue — seeded to the `permissions` table on first run
// ---------------------------------------------------------------------------

export interface PermissionDefinition {
    resource: string;
    action: string;
    scope: 'PLATFORM' | 'WORKSPACE';
    description?: string;
}

/**
 * Full catalogue of system permissions. Each entry maps to a row in the
 * `permissions` table. The `key` column is computed as "{resource}.{action}".
 */
export const PERMISSION_CATALOGUE: PermissionDefinition[] = [
    // ── Workspace-scoped ──
    { resource: 'workspace', action: 'read',   scope: 'WORKSPACE', description: 'View workspace dashboard and basic info' },
    { resource: 'workspace', action: 'update', scope: 'WORKSPACE', description: 'Edit workspace settings' },
    { resource: 'workspace', action: 'delete', scope: 'WORKSPACE', description: 'Delete the workspace entirely' },
    { resource: 'workspace', action: 'manage', scope: 'WORKSPACE', description: 'Full workspace administration' },

    { resource: 'assets', action: 'create', scope: 'WORKSPACE', description: 'Create new assets' },
    { resource: 'assets', action: 'read',   scope: 'WORKSPACE', description: 'View asset inventory' },
    { resource: 'assets', action: 'update', scope: 'WORKSPACE', description: 'Edit existing assets' },
    { resource: 'assets', action: 'delete', scope: 'WORKSPACE', description: 'Delete assets' },
    { resource: 'assets', action: 'manage', scope: 'WORKSPACE', description: 'Full asset management' },

    { resource: 'members', action: 'read',   scope: 'WORKSPACE', description: 'View team members' },
    { resource: 'members', action: 'invite', scope: 'WORKSPACE', description: 'Invite new members' },
    { resource: 'members', action: 'remove', scope: 'WORKSPACE', description: 'Remove members from workspace' },
    { resource: 'members', action: 'manage', scope: 'WORKSPACE', description: 'Full member management' },

    { resource: 'roles', action: 'read',   scope: 'WORKSPACE', description: 'View workspace roles' },
    { resource: 'roles', action: 'create', scope: 'WORKSPACE', description: 'Create custom workspace roles' },
    { resource: 'roles', action: 'update', scope: 'WORKSPACE', description: 'Edit workspace roles' },
    { resource: 'roles', action: 'delete', scope: 'WORKSPACE', description: 'Delete workspace roles' },
    { resource: 'roles', action: 'assign', scope: 'WORKSPACE', description: 'Assign roles to members' },

    { resource: 'analytics', action: 'read',   scope: 'WORKSPACE', description: 'View analytics dashboards' },
    { resource: 'reports',   action: 'read',   scope: 'WORKSPACE', description: 'View and export reports' },
    { resource: 'reports',   action: 'create', scope: 'WORKSPACE', description: 'Create report schedules' },

    { resource: 'alerts', action: 'read',   scope: 'WORKSPACE', description: 'View alert rules and history' },
    { resource: 'alerts', action: 'manage', scope: 'WORKSPACE', description: 'Create/edit/delete alert rules' },

    { resource: 'integrations', action: 'read',   scope: 'WORKSPACE', description: 'View integrations' },
    { resource: 'integrations', action: 'manage', scope: 'WORKSPACE', description: 'Configure integrations' },

    { resource: 'billing', action: 'read',   scope: 'WORKSPACE', description: 'View billing and subscription' },
    { resource: 'billing', action: 'manage', scope: 'WORKSPACE', description: 'Manage billing and payments' },

    { resource: 'remote', action: 'read',    scope: 'WORKSPACE', description: 'View remote sessions' },
    { resource: 'remote', action: 'connect', scope: 'WORKSPACE', description: 'Start remote session' },

    { resource: 'scripts', action: 'read',    scope: 'WORKSPACE', description: 'View scripts' },
    { resource: 'scripts', action: 'create',  scope: 'WORKSPACE', description: 'Create scripts' },
    { resource: 'scripts', action: 'execute', scope: 'WORKSPACE', description: 'Execute scripts on agents' },
    { resource: 'scripts', action: 'manage',  scope: 'WORKSPACE', description: 'Full script management' },

    { resource: 'agents', action: 'read',   scope: 'WORKSPACE', description: 'View connected agents' },
    { resource: 'agents', action: 'manage', scope: 'WORKSPACE', description: 'Manage agent connections' },

    // ── Platform-scoped (Super Admin) ──
    { resource: 'platform',   action: 'manage',    scope: 'PLATFORM', description: 'Full platform administration' },
    { resource: 'users',      action: 'read',      scope: 'PLATFORM', description: 'View all platform users' },
    { resource: 'users',      action: 'create',    scope: 'PLATFORM', description: 'Create platform users' },
    { resource: 'users',      action: 'update',    scope: 'PLATFORM', description: 'Edit platform users' },
    { resource: 'users',      action: 'delete',    scope: 'PLATFORM', description: 'Delete platform users' },
    { resource: 'users',      action: 'manage',    scope: 'PLATFORM', description: 'Full user management' },

    { resource: 'roles',      action: 'read',   scope: 'PLATFORM', description: 'View platform roles' },
    { resource: 'roles',      action: 'create', scope: 'PLATFORM', description: 'Create platform roles' },
    { resource: 'roles',      action: 'update', scope: 'PLATFORM', description: 'Edit platform roles' },
    { resource: 'roles',      action: 'delete', scope: 'PLATFORM', description: 'Delete platform roles' },
    { resource: 'roles',      action: 'assign', scope: 'PLATFORM', description: 'Assign roles to users' },

    { resource: 'workspaces', action: 'read',   scope: 'PLATFORM', description: 'View all workspaces' },
    { resource: 'workspaces', action: 'manage', scope: 'PLATFORM', description: 'Manage any workspace' },

    { resource: 'billing',    action: 'read',   scope: 'PLATFORM', description: 'View platform billing' },
    { resource: 'billing',    action: 'manage', scope: 'PLATFORM', description: 'Manage platform billing' },

    { resource: 'audit',      action: 'read',   scope: 'PLATFORM', description: 'View audit logs' },
    { resource: 'analytics',  action: 'read',   scope: 'PLATFORM', description: 'View platform analytics' },

    { resource: 'partners',   action: 'read',   scope: 'PLATFORM', description: 'View partner ecosystem' },
    { resource: 'partners',   action: 'manage', scope: 'PLATFORM', description: 'Manage partners' },
];

/**
 * Computes the permission key from resource + action.
 * This is the canonical format used in DB lookups and permission graphs.
 */
export function permissionKey(resource: string, action: string): string {
    return `${resource}.${action}`;
}

// ---------------------------------------------------------------------------
// Default role → permission templates
// ---------------------------------------------------------------------------

/**
 * Maps built-in workspace roles to their default permission keys.
 * Used when seeding permissions and when creating default workspace roles.
 */
export const WORKSPACE_ROLE_DEFAULTS: Record<string, string[]> = {
    VIEWER: [
        'workspace.read',
        'assets.read',
        'analytics.read',
        'reports.read',
        'alerts.read',
        'agents.read',
    ],
    MEMBER: [
        'workspace.read',
        'assets.create', 'assets.read', 'assets.update', 'assets.manage',
        'analytics.read',
        'reports.read',
        'alerts.read',
        'agents.read',
        'remote.read',
        'scripts.read',
    ],
    STAFF: [
        'workspace.read',
        'assets.create', 'assets.read', 'assets.update', 'assets.delete', 'assets.manage',
        'analytics.read',
        'reports.read', 'reports.create',
        'alerts.read', 'alerts.manage',
        'members.read',
        'agents.read', 'agents.manage',
        'remote.read', 'remote.connect',
        'scripts.read', 'scripts.create', 'scripts.execute',
    ],
    ADMIN: [
        'workspace.read', 'workspace.update', 'workspace.manage',
        'assets.create', 'assets.read', 'assets.update', 'assets.delete', 'assets.manage',
        'analytics.read',
        'reports.read', 'reports.create',
        'alerts.read', 'alerts.manage',
        'members.read', 'members.invite', 'members.remove', 'members.manage',
        'roles.read', 'roles.create', 'roles.update', 'roles.delete', 'roles.assign',
        'integrations.read', 'integrations.manage',
        'agents.read', 'agents.manage',
        'remote.read', 'remote.connect',
        'scripts.read', 'scripts.create', 'scripts.execute', 'scripts.manage',
    ],
    OWNER: [
        'workspace.read', 'workspace.update', 'workspace.delete', 'workspace.manage',
        'assets.create', 'assets.read', 'assets.update', 'assets.delete', 'assets.manage',
        'analytics.read',
        'reports.read', 'reports.create',
        'alerts.read', 'alerts.manage',
        'members.read', 'members.invite', 'members.remove', 'members.manage',
        'roles.read', 'roles.create', 'roles.update', 'roles.delete', 'roles.assign',
        'integrations.read', 'integrations.manage',
        'billing.read', 'billing.manage',
        'agents.read', 'agents.manage',
        'remote.read', 'remote.connect',
        'scripts.read', 'scripts.create', 'scripts.execute', 'scripts.manage',
    ],
};

/**
 * Maps platform roles to their default permission keys.
 */
export const PLATFORM_ROLE_DEFAULTS: Record<string, string[]> = {
    SUPER_ADMIN: PERMISSION_CATALOGUE
        .filter((p) => p.scope === 'PLATFORM')
        .map((p) => permissionKey(p.resource, p.action)),
    ADMIN: PERMISSION_CATALOGUE
        .filter((p) => p.scope === 'PLATFORM')
        .map((p) => permissionKey(p.resource, p.action)),
    IT_STAFF: [
        'users.read',
        'workspaces.read',
        'audit.read',
        'analytics.read',
    ],
    USER: [],
};

// ---------------------------------------------------------------------------
// Legacy permission bridge
// ---------------------------------------------------------------------------

/**
 * Maps legacy permission constants to the new resource.action format.
 * This allows existing code using PERMISSIONS.INVITE_MEMBERS to coexist
 * with the new dynamic system.
 */
export const LEGACY_TO_DYNAMIC: Record<string, string> = {
    view_workspace:       'workspace.read',
    view_analytics:       'analytics.read',
    view_reports:         'reports.read',
    create_asset:         'assets.create',
    edit_asset:           'assets.update',
    delete_asset:         'assets.delete',
    manage_assets:        'assets.manage',
    manage_alerts:        'alerts.manage',
    view_users:           'members.read',
    invite_members:       'members.invite',
    remove_members:       'members.remove',
    manage_workspace:     'workspace.manage',
    manage_integrations:  'integrations.manage',
    manage_billing:       'billing.manage',
    delete_workspace:     'workspace.delete',
    super_admin_access:   'platform.manage',
};

// ---------------------------------------------------------------------------
// Core access check — works with the permission graph
// ---------------------------------------------------------------------------

/**
 * Check whether a user can perform `action` on `resource` in the given
 * workspace context. This evaluates the dynamic permission graph.
 *
 * @param graph       — the hydrated permission graph (from cache or DB)
 * @param resource    — e.g. "users", "assets", "billing"
 * @param action      — e.g. "create", "read", "update", "delete", "manage"
 * @param workspaceId — null for platform-scoped checks
 *
 * Evaluation order:
 *   1. Super admin (graph.isStaff) → always true
 *   2. "manage" action on the same resource → implies all other actions
 *   3. Platform scope → check globalPermissions
 *   4. Workspace scope → check workspace permissions
 *   5. Fall through → false
 */
export function canAccess(
    graph: UserPermissionGraph,
    resource: string,
    action: string,
    workspaceId?: string | null,
): boolean {
    // 1. Super admin bypass
    if (graph.isStaff) return true;

    const key = permissionKey(resource, action);
    const manageKey = permissionKey(resource, 'manage');

    if (workspaceId) {
        // Workspace-scoped check
        const ws = graph.workspaces.find((w) => w.workspaceId === workspaceId);
        if (!ws) return false;

        // Owner override → full access within workspace
        if (ws.ownerId === graph.userId) return true;

        // Check dynamic permission keys
        const perms = ws.dynamicPermissions ?? ws.permissions;
        if (perms.includes(key)) return true;
        // "manage" implies all actions on the same resource
        if (action !== 'manage' && perms.includes(manageKey)) return true;

        return false;
    }

    // Platform-scoped check
    const allPerms = graph.globalPermissions;
    if (allPerms.includes(key)) return true;
    if (action !== 'manage' && allPerms.includes(manageKey)) return true;

    // Also check "platform.manage" as a super-permission
    if (allPerms.includes('platform.manage')) return true;

    return false;
}

/**
 * Check multiple permissions — returns true if ALL are satisfied.
 */
export function canAccessAll(
    graph: UserPermissionGraph,
    checks: Array<{ resource: string; action: string }>,
    workspaceId?: string | null,
): boolean {
    return checks.every((c) => canAccess(graph, c.resource, c.action, workspaceId));
}

/**
 * Check multiple permissions — returns true if ANY is satisfied.
 */
export function canAccessAny(
    graph: UserPermissionGraph,
    checks: Array<{ resource: string; action: string }>,
    workspaceId?: string | null,
): boolean {
    return checks.some((c) => canAccess(graph, c.resource, c.action, workspaceId));
}
