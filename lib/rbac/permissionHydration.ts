/**
 * RBAC Permission Hydration Service
 *
 * Loads the complete permission graph for a user in a SINGLE Prisma query.
 * Zero N+1 — all workspace memberships, roles, and the user profile are
 * fetched in one round-trip using nested includes/selects.
 *
 * This is the DB fallback when the Redis cache misses.
 *
 * Flow:
 *   1. Check Redis cache (permissionCache.getPermissionCache)
 *   2. On miss → hydrateUserPermissions (this file)
 *   3. Derive permissions from role via ROLE_PERMISSIONS
 *   4. Store result back to Redis
 *   5. Return graph
 */

import { prisma } from '@/lib/db';
import { ROLE_PERMISSIONS } from '@/utils/rbac';
import {
    getPermissionCache,
    setPermissionCache,
    type UserPermissionGraph,
    type WorkspacePermissionEntry,
} from '@/lib/rbac/permissionCache';

// ---------------------------------------------------------------------------
// Single-query data shape returned by Prisma
// ---------------------------------------------------------------------------

const USER_PERMISSION_SELECT = {
    id: true,
    email: true,
    name: true,
    isStaff: true,
    onboardingCompleted: true,
    emailVerified: true,
    createdAt: true,
    // Platform role with its dynamic permissions
    platformRole: {
        select: {
            id: true,
            name: true,
            permissions: {
                select: {
                    permission: {
                        select: { key: true },
                    },
                },
            },
        },
    },
    // Custom workspace role memberships (dynamic permissions)
    customRoleMemberships: {
        select: {
            role: {
                select: {
                    workspaceId: true,
                    permissions: {
                        select: {
                            permission: {
                                select: { key: true },
                            },
                        },
                    },
                },
            },
        },
    },
    // All workspace memberships the user belongs to (non-owner)
    workspaceMemberships: {
        where: { workspace: { deletedAt: null } },
        select: {
            id: true,
            role: true,
            workspace: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logo: true,
                    ownerId: true,
                },
            },
        },
    },
    // Workspaces the user owns
    ownedWorkspaces: {
        where: { deletedAt: null },
        select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            ownerId: true,
        },
    },
} as const;

// ---------------------------------------------------------------------------
// Hydration — DB path (zero N+1)
// ---------------------------------------------------------------------------

/**
 * Build and return the full permission graph for `userId`.
 *
 * Uses a single Prisma query that eagerly loads all workspace memberships
 * and owned workspaces. Role → permissions derivation is done in-process
 * using the ROLE_PERMISSIONS map (no additional queries).
 *
 * @param userId  — the user to hydrate
 * @param skipCache — when true, bypass Redis and always rebuild from DB
 *                    (useful after a role change in the same request lifecycle)
 */
export async function hydrateUserPermissions(
    userId: string,
    skipCache = false,
): Promise<UserPermissionGraph> {
    // 1. Try Redis cache first
    if (!skipCache) {
        const cached = await getPermissionCache(userId);
        if (cached) return cached;
    }

    // 2. Single query — loads user + all memberships + all owned workspaces
    const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: USER_PERMISSION_SELECT,
    });

    // 3. Build a map of dynamic permissions from custom workspace role memberships
    //    Maps workspaceId → Set<permissionKey>
    const dynamicWsPerms = new Map<string, Set<string>>();
    for (const crm of user.customRoleMemberships) {
        const wsId = crm.role.workspaceId;
        if (!dynamicWsPerms.has(wsId)) dynamicWsPerms.set(wsId, new Set());
        const set = dynamicWsPerms.get(wsId)!;
        for (const rp of crm.role.permissions) {
            set.add(rp.permission.key);
        }
    }

    // 4. Build workspace entries from owned workspaces (OWNER role)
    const ownedEntries: WorkspacePermissionEntry[] = user.ownedWorkspaces.map((ws) => ({
        workspaceId: ws.id,
        workspaceName: ws.name,
        role: 'OWNER',
        ownerId: ws.ownerId,
        permissions: ROLE_PERMISSIONS['OWNER'] ?? [],
        dynamicPermissions: dynamicWsPerms.has(ws.id)
            ? Array.from(dynamicWsPerms.get(ws.id)!)
            : [],
    }));

    // 5. Build workspace entries from memberships (ADMIN | STAFF | MEMBER | VIEWER)
    //    Filter out any owned workspaces to avoid duplicates (rare edge case where
    //    a user is both the owner and has an explicit membership row).
    const ownedIds = new Set(user.ownedWorkspaces.map((ws) => ws.id));

    const memberEntries: WorkspacePermissionEntry[] = user.workspaceMemberships
        .filter((m) => !ownedIds.has(m.workspace.id))
        .map((m) => ({
            workspaceId: m.workspace.id,
            workspaceName: m.workspace.name,
            role: m.role as string,
            ownerId: m.workspace.ownerId,
            permissions: ROLE_PERMISSIONS[m.role as string] ?? [],
            dynamicPermissions: dynamicWsPerms.has(m.workspace.id)
                ? Array.from(dynamicWsPerms.get(m.workspace.id)!)
                : [],
        }));

    // 6. Derive global permissions
    //    Staff users get super_admin_access globally; regular users have no
    //    global permissions (all access is workspace-scoped).
    //    Also include dynamic permissions from platform role.
    const platformDynamicPerms: string[] = user.platformRole?.permissions
        ?.map((rp) => rp.permission.key) ?? [];

    const globalPermissions: string[] = user.isStaff
        ? [...(ROLE_PERMISSIONS['SUPER_ADMIN'] ?? []), ...platformDynamicPerms]
        : platformDynamicPerms;

    const graph: UserPermissionGraph = {
        userId: user.id,
        isStaff: user.isStaff,
        globalPermissions,
        workspaces: [...ownedEntries, ...memberEntries],
        cachedAt: new Date().toISOString(),
    };

    // 6. Store in Redis for subsequent requests
    await setPermissionCache(graph);

    return graph;
}

// ---------------------------------------------------------------------------
// Public profile shape (used by /api/auth/me)
// ---------------------------------------------------------------------------

export interface HydratedUserProfile {
    id: string;
    email: string;
    name: string | null;
    isStaff: boolean;
    onboardingCompleted: boolean;
    emailVerified: boolean;
    createdAt: Date;
    workspaces: Array<{
        id: string;
        name: string;
        slug: string;
        logo: string | null;
        role: string;
        ownerId: string;
    }>;
}

/**
 * Returns the user profile shape that /me serves to the frontend.
 * Also calls hydrateUserPermissions() so the permission graph is
 * always cached by the time the endpoint responds.
 */
export async function getHydratedUserProfile(
    userId: string,
): Promise<{ profile: HydratedUserProfile; graph: UserPermissionGraph }> {
    const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: USER_PERMISSION_SELECT,
    });

    const ownedIds = new Set(user.ownedWorkspaces.map((ws) => ws.id));

    const workspaces = [
        ...user.ownedWorkspaces.map((ws) => ({
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            logo: ws.logo ?? null,
            role: 'OWNER' as const,
            ownerId: ws.ownerId,
        })),
        ...user.workspaceMemberships
            .filter((m) => !ownedIds.has(m.workspace.id))
            .map((m) => ({
                id: m.workspace.id,
                name: m.workspace.name,
                slug: m.workspace.slug,
                logo: m.workspace.logo ?? null,
                role: m.role as string,
                ownerId: m.workspace.ownerId,
            })),
    ];

    const profile: HydratedUserProfile = {
        id: user.id,
        email: user.email,
        name: user.name,
        isStaff: user.isStaff,
        onboardingCompleted: user.onboardingCompleted,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        workspaces,
    };

    // Build and cache the permission graph from the same data (no second query)
    // Build dynamic permission map from custom role memberships
    const dynamicWsPermsProfile = new Map<string, Set<string>>();
    for (const crm of user.customRoleMemberships) {
        const wsId = crm.role.workspaceId;
        if (!dynamicWsPermsProfile.has(wsId)) dynamicWsPermsProfile.set(wsId, new Set());
        const set = dynamicWsPermsProfile.get(wsId)!;
        for (const rp of crm.role.permissions) {
            set.add(rp.permission.key);
        }
    }

    const ownedEntries: WorkspacePermissionEntry[] = user.ownedWorkspaces.map((ws) => ({
        workspaceId: ws.id,
        workspaceName: ws.name,
        role: 'OWNER',
        ownerId: ws.ownerId,
        permissions: ROLE_PERMISSIONS['OWNER'] ?? [],
        dynamicPermissions: dynamicWsPermsProfile.has(ws.id)
            ? Array.from(dynamicWsPermsProfile.get(ws.id)!)
            : [],
    }));

    const memberEntries: WorkspacePermissionEntry[] = user.workspaceMemberships
        .filter((m) => !ownedIds.has(m.workspace.id))
        .map((m) => ({
            workspaceId: m.workspace.id,
            workspaceName: m.workspace.name,
            role: m.role as string,
            ownerId: m.workspace.ownerId,
            permissions: ROLE_PERMISSIONS[m.role as string] ?? [],
            dynamicPermissions: dynamicWsPermsProfile.has(m.workspace.id)
                ? Array.from(dynamicWsPermsProfile.get(m.workspace.id)!)
                : [],
        }));

    const platformDynPerms: string[] = user.platformRole?.permissions
        ?.map((rp) => rp.permission.key) ?? [];

    const graph: UserPermissionGraph = {
        userId: user.id,
        isStaff: user.isStaff,
        globalPermissions: user.isStaff
            ? [...(ROLE_PERMISSIONS['SUPER_ADMIN'] ?? []), ...platformDynPerms]
            : platformDynPerms,
        workspaces: [...ownedEntries, ...memberEntries],
        cachedAt: new Date().toISOString(),
    };

    await setPermissionCache(graph);

    return { profile, graph };
}
