/**
 * Dynamic Permission Middleware
 *
 * Provides `requirePermission()` — a backend function that enforces
 * resource.action permissions using the DB-backed permission graph.
 *
 * Usage in API routes:
 *   const user = await requireAuth();
 *   await requirePermission(user.id, 'assets', 'create', workspaceId);
 *
 * This always re-validates from the server — never trusts frontend state.
 */

import { hydrateUserPermissions } from '@/lib/rbac/permissionHydration';
import { canAccess } from '@/lib/rbac/permissions';
import { ApiError } from '@/lib/errors';

/**
 * Enforce that the authenticated user has `{resource}.{action}` permission.
 *
 * @param userId      — the authenticated user's ID
 * @param resource    — e.g. "assets", "users", "billing"
 * @param action      — e.g. "create", "read", "update", "delete", "manage"
 * @param workspaceId — required for workspace-scoped permissions; null for platform scope
 *
 * @throws ApiError(403) if permission check fails
 */
export async function requirePermission(
    userId: string,
    resource: string,
    action: string,
    workspaceId?: string | null,
): Promise<void> {
    const graph = await hydrateUserPermissions(userId);

    if (!canAccess(graph, resource, action, workspaceId)) {
        throw new ApiError(
            403,
            `Permission denied: ${resource}.${action}`,
        );
    }
}

/**
 * Check (non-throwing) whether the user has a specific permission.
 * Returns boolean — useful for conditional logic in route handlers.
 */
export async function hasPermission(
    userId: string,
    resource: string,
    action: string,
    workspaceId?: string | null,
): Promise<boolean> {
    const graph = await hydrateUserPermissions(userId);
    return canAccess(graph, resource, action, workspaceId);
}

/**
 * Require ALL of the listed permissions.
 */
export async function requirePermissions(
    userId: string,
    checks: Array<{ resource: string; action: string }>,
    workspaceId?: string | null,
): Promise<void> {
    const graph = await hydrateUserPermissions(userId);

    for (const { resource, action } of checks) {
        if (!canAccess(graph, resource, action, workspaceId)) {
            throw new ApiError(
                403,
                `Permission denied: ${resource}.${action}`,
            );
        }
    }
}

/**
 * Require ANY of the listed permissions (at least one must match).
 */
export async function requireAnyPermission(
    userId: string,
    checks: Array<{ resource: string; action: string }>,
    workspaceId?: string | null,
): Promise<void> {
    const graph = await hydrateUserPermissions(userId);
    const hasAny = checks.some(({ resource, action }) =>
        canAccess(graph, resource, action, workspaceId),
    );

    if (!hasAny) {
        const keys = checks.map((c) => `${c.resource}.${c.action}`).join(', ');
        throw new ApiError(403, `Permission denied: requires one of [${keys}]`);
    }
}
