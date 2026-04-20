/**
 * Dynamic Menu Service
 *
 * Generates the navigation menu for a user based on their cached
 * permission graph.  Only items whose permission requirement is satisfied
 * are included — no secrets are leaked to under-privileged users.
 *
 * The menu is generated on the server and served as part of the /me
 * response, so the frontend never needs to calculate what it should show.
 *
 * Security note: the frontend must still gate actual actions behind the
 * backend — hiding a menu item is UX convenience, not a security control.
 */

import { PERMISSIONS } from '@/utils/rbac';
import type { UserPermissionGraph } from '@/lib/rbac/permissionCache';

// ---------------------------------------------------------------------------
// Menu definition
// ---------------------------------------------------------------------------

export interface MenuItem {
    label: string;
    route: string;
    icon?: string;
    /** Null means always visible (no permission required). */
    permission: string | null;
    children?: MenuItem[];
}

/**
 * The full application menu catalogue.
 * Items are filtered per-user based on their permission graph.
 *
 * Add or reorder items here as the application grows.
 */
const FULL_MENU: MenuItem[] = [
    {
        label: 'Dashboard',
        route: '/dashboard',
        icon: 'layout-dashboard',
        permission: PERMISSIONS.VIEW_WORKSPACE,
    },
    {
        label: 'Assets',
        route: '/dashboard/assets',
        icon: 'server',
        permission: PERMISSIONS.VIEW_WORKSPACE,
        children: [
            {
                label: 'All Assets',
                route: '/dashboard/assets',
                permission: PERMISSIONS.VIEW_WORKSPACE,
            },
            {
                label: 'Add Asset',
                route: '/dashboard/assets/new',
                permission: PERMISSIONS.CREATE_ASSET,
            },
        ],
    },
    {
        label: 'Alerts',
        route: '/dashboard/alerts',
        icon: 'bell',
        permission: PERMISSIONS.VIEW_ANALYTICS,
        children: [
            {
                label: 'Alert Rules',
                route: '/dashboard/alerts',
                permission: PERMISSIONS.VIEW_ANALYTICS,
            },
            {
                label: 'Manage Alerts',
                route: '/dashboard/alerts/manage',
                permission: PERMISSIONS.MANAGE_ALERTS,
            },
        ],
    },
    {
        label: 'Analytics',
        route: '/dashboard/analytics',
        icon: 'bar-chart-2',
        permission: PERMISSIONS.VIEW_ANALYTICS,
    },
    {
        label: 'Reports',
        route: '/dashboard/reports',
        icon: 'file-text',
        permission: PERMISSIONS.VIEW_REPORTS,
    },
    {
        label: 'Remote',
        route: '/remote',
        icon: 'monitor',
        permission: PERMISSIONS.VIEW_WORKSPACE,
    },
    {
        label: 'Team',
        route: '/workspaces/manage/members',
        icon: 'users',
        permission: PERMISSIONS.VIEW_USERS,
    },
    {
        label: 'Workspace Settings',
        route: '/workspaces/manage/settings',
        icon: 'settings',
        permission: PERMISSIONS.MANAGE_WORKSPACE,
        children: [
            {
                label: 'General',
                route: '/workspaces/manage/settings',
                permission: PERMISSIONS.MANAGE_WORKSPACE,
            },
            {
                label: 'Integrations',
                route: '/workspaces/manage/integrations',
                permission: PERMISSIONS.MANAGE_INTEGRATIONS,
            },
            {
                label: 'Billing',
                route: '/workspaces/manage/billing',
                permission: PERMISSIONS.MANAGE_BILLING,
            },
        ],
    },
    {
        label: 'Super Admin',
        route: '/super-admin',
        icon: 'shield',
        permission: PERMISSIONS.SUPER_ADMIN_ACCESS,
    },
];

// ---------------------------------------------------------------------------
// Permission check (pure — no DB, no Redis)
// ---------------------------------------------------------------------------

function hasPermissionInGraph(
    graph: UserPermissionGraph,
    permission: string,
    workspaceId: string | null,
): boolean {
    // Super admin bypass
    if (graph.isStaff) return true;

    if (workspaceId) {
        const ws = graph.workspaces.find((w) => w.workspaceId === workspaceId);
        if (!ws) return false;
        // Owner override
        if (ws.ownerId === graph.userId) return true;
        return ws.permissions.includes(permission);
    }

    // Global permissions
    return graph.globalPermissions.includes(permission);
}

// ---------------------------------------------------------------------------
// Filter helper (recursive — handles children)
// ---------------------------------------------------------------------------

function filterMenu(
    items: MenuItem[],
    graph: UserPermissionGraph,
    workspaceId: string | null,
): MenuItem[] {
    return items.reduce<MenuItem[]>((acc, item) => {
        // Permission check
        if (
            item.permission !== null &&
            !hasPermissionInGraph(graph, item.permission, workspaceId)
        ) {
            return acc;
        }

        // Recursively filter children
        const filteredChildren = item.children
            ? filterMenu(item.children, graph, workspaceId)
            : undefined;

        acc.push({
            ...item,
            ...(filteredChildren !== undefined ? { children: filteredChildren } : {}),
        });

        return acc;
    }, []);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the navigation menu filtered to only include items the user
 * has permission to see.
 *
 * @param graph        — permission graph from Redis or DB hydration
 * @param workspaceId  — the active workspace; null yields global menu
 */
export function getUserMenu(
    graph: UserPermissionGraph,
    workspaceId: string | null,
): MenuItem[] {
    return filterMenu(FULL_MENU, graph, workspaceId);
}
