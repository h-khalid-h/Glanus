/**
 * GET /api/auth/me
 *
 * Single source of truth for frontend RBAC hydration.
 *
 * Returns a fully hydrated response in ONE database round-trip (zero N+1):
 *  - user profile
 *  - workspace memberships with roles
 *  - pre-computed permission graph (per workspace)
 *  - dynamic navigation menu filtered to permitted items
 *
 * Redis cache: permissions are cached under rbac:user:{id}:global (15 min TTL).
 * On cache hit the DB query is skipped entirely.
 *
 * Cache is automatically invalidated whenever a role changes, a member is
 * added/removed, or workspace ownership is transferred (see WorkspaceMemberService).
 */

import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { getToken } from 'next-auth/jwt';
import { getHydratedUserProfile } from '@/lib/rbac/permissionHydration';
import { getUserMenu } from '@/lib/rbac/menuService';

export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    // Read the active workspace from the JWT claim (set by /api/auth/switch-workspace).
    // Falls back to null if the user hasn't switched yet; menu/permissions will be
    // returned without a workspace-scoped filter in that case.
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const activeWorkspaceId = typeof token?.wid === 'string' ? token.wid : null;

    // Single Prisma query → profile + permission graph, then cached in Redis
    const { profile, graph } = await getHydratedUserProfile(user.id);

    // Resolve the active workspace entry for the response
    const activeWorkspace = activeWorkspaceId
        ? profile.workspaces.find((w) => w.id === activeWorkspaceId) ?? null
        : (profile.workspaces[0] ?? null);

    // Build workspace-filtered menu (or global menu if no active workspace)
    const menu = getUserMenu(graph, activeWorkspace?.id ?? null);

    // Extract dynamic permission keys for the frontend store
    const dynamicPermissions = graph.globalPermissions.filter((p) => p.includes('.'));
    const workspaceDynamicPermissions: Record<string, string[]> = {};
    for (const ws of graph.workspaces) {
        if (ws.dynamicPermissions?.length) {
            workspaceDynamicPermissions[ws.workspaceId] = ws.dynamicPermissions;
        }
    }

    return apiSuccess({
        user: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            isStaff: profile.isStaff,
            onboardingCompleted: profile.onboardingCompleted,
            emailVerified: profile.emailVerified,
            createdAt: profile.createdAt,
        },
        workspaces: profile.workspaces,
        activeWorkspace,
        permissions: graph,
        menu,
        dynamicPermissions,
        workspaceDynamicPermissions,
    });
});

