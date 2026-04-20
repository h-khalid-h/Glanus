/**
 * RBAC Permission Cache
 *
 * Caches fully-hydrated user permission graphs in Redis.
 * This is a pure optimization layer — the backend always re-validates
 * permissions from the DB; the cache just prevents redundant queries.
 *
 * Key schema (workspace-scoped):
 *   rbac:user:{userId}:ws:{workspaceId}
 *
 * Key schema (global — all workspaces for a user):
 *   rbac:user:{userId}:global
 *
 * TTL: 15 minutes (matches JWT access-token lifetime so stale data
 * is automatically evicted when users refresh their sessions).
 *
 * Fallback: When Redis is unavailable every get() returns null so the
 * caller falls through to the DB hydration path transparently.
 */

import { getAuthRedis } from '@/lib/auth/redis';
import { logError } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single workspace entry in the permission graph. */
export interface WorkspacePermissionEntry {
    workspaceId: string;
    workspaceName: string;
    role: string;
    ownerId: string;
    permissions: string[];
    /** Dynamic permission keys from custom workspace roles (resource.action format). */
    dynamicPermissions?: string[];
}

/** Full permission graph cached per user. */
export interface UserPermissionGraph {
    userId: string;
    isStaff: boolean;
    /** Flat list of global (non-workspace-scoped) permissions. */
    globalPermissions: string[];
    /** One entry per workspace the user belongs to (including owned ones). */
    workspaces: WorkspacePermissionEntry[];
    /** ISO timestamp — used for debugging stale cache hits. */
    cachedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 15 minutes — matches the JWT access-token lifetime. */
const CACHE_TTL_SECONDS = 15 * 60;

const KEY_PREFIX = 'rbac:user';

function globalKey(userId: string): string {
    return `${KEY_PREFIX}:${userId}:global`;
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Read the permission graph for a user from Redis.
 * Returns null on cache miss OR when Redis is unavailable.
 */
export async function getPermissionCache(
    userId: string,
): Promise<UserPermissionGraph | null> {
    const redis = await getAuthRedis();
    if (!redis) return null;

    try {
        const raw = await redis.get(globalKey(userId));
        if (!raw) return null;
        return JSON.parse(raw) as UserPermissionGraph;
    } catch (err) {
        logError('RBAC cache read error', err);
        return null;
    }
}

/**
 * Write the permission graph to Redis with a 15-minute TTL.
 * Silently drops errors so a Redis outage never blocks a request.
 */
export async function setPermissionCache(
    graph: UserPermissionGraph,
): Promise<void> {
    const redis = await getAuthRedis();
    if (!redis) return;

    try {
        await redis.setEx(
            globalKey(graph.userId),
            CACHE_TTL_SECONDS,
            JSON.stringify(graph),
        );
    } catch (err) {
        logError('RBAC cache write error', err);
    }
}

/**
 * Invalidate the permission cache for a user.
 *
 * Call this whenever any membership state changes:
 *  - role assigned or changed
 *  - user added to or removed from a workspace
 *  - workspace ownership transferred
 *
 * The next request will rebuild from the DB via hydrateUserPermissions().
 */
export async function invalidatePermissionCache(userId: string): Promise<void> {
    const redis = await getAuthRedis();
    if (!redis) return;

    try {
        await redis.del(globalKey(userId));
    } catch (err) {
        logError('RBAC cache invalidation error', err);
    }
}
