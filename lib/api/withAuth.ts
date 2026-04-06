/**
 * Shared Authentication & Authorization Middleware
 * 
 * Eliminates repeated auth boilerplate from every API route.
 * Provides reusable functions for session validation, 
 * workspace access, and role-based permission checks.
 */

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { ValidationError } from '@/lib/validation';
import type { WorkspaceRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { withRLSContext } from '@/lib/rls-context';
import { hashAgentToken } from '@/lib/security/agent-auth';
import { authCache, workspaceCache } from '@/lib/cache';

// Import ApiError from canonical errors module for internal use, and re-export for routes
import { ApiError } from '@/lib/errors';
export { ApiError } from '@/lib/errors';


// ============================================
// Core Auth Functions
// ============================================

/**
 * Get the authenticated user from the session.
 * Throws ApiError(401) if not authenticated.
 */
export async function requireAuth() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        throw new ApiError(401, 'Unauthorized');
    }

    const email = session.user.email;
    const cacheKey = `user:${email}`;
    const cached = authCache.get<Awaited<ReturnType<typeof prisma.user.findUnique>>>(cacheKey);
    if (cached) return cached;

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        throw new ApiError(401, 'User not found');
    }

    authCache.set(cacheKey, user, 5_000); // 5s TTL
    return user;
}

/**
 * Verify that a user has access to a workspace.
 * Returns the workspace, membership, and effective role.
 * Throws ApiError(403) if no access.
 */
export async function requireWorkspaceAccess(
    workspaceId: string,
    userId: string,
    request?: NextRequest
) {
    const cacheKey = `ws:${workspaceId}:${userId}`;
    const cachedAccess = workspaceCache.get<{
        workspace: NonNullable<Awaited<ReturnType<typeof prisma.workspace.findUnique>>>;
        membership: unknown;
        role: WorkspaceRole;
    }>(cacheKey);
    if (cachedAccess && !request) return cachedAccess;

    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
            id: true,
            ownerId: true,
            name: true,
            slug: true,
            description: true,
            logo: true,
            primaryColor: true,
            accentColor: true,
            settings: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            subscription: true,
            members: {
                where: { userId },
            },
            ztnaPolicies: request ? {
                where: { isEnabled: true }
            } : false,
        },
    });

    if (!workspace) {
        throw new ApiError(404, 'Workspace not found');
    }

    const isOwner = workspace.ownerId === userId;
    const membership = workspace.members[0];

    if (!isOwner && !membership) {
        throw new ApiError(403, 'Access denied');
    }

    // Evaluate ZTNA
    if (request && workspace.ztnaPolicies.length > 0) {
        // Extract IP from Vercel/Nginx proxy array or fallback to raw connection
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
            || request.headers.get('x-real-ip')
            || '127.0.0.1';

        for (const policy of workspace.ztnaPolicies) {
            const whitelistedIps = policy.ipWhitelist.split(',').map((i: string) => i.trim());
            // Simplistic exact match logic. Extend with CIDR libraries if necessary.
            if (!whitelistedIps.includes(ip) && policy.action === 'BLOCK') {
                throw new ApiError(403, 'Access denied by Workspace Zero-Trust Network Policy');
            }
        }
    }

    const effectiveRole: WorkspaceRole = isOwner
        ? 'OWNER'
        : membership.role;

    const result = {
        workspace,
        membership,
        role: effectiveRole,
    };

    workspaceCache.set(cacheKey, result, 15_000); // 15s TTL
    return result;
}

/**
 * Verify workspace access with a minimum role requirement.
 * Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
 */
export async function requireWorkspaceRole(
    workspaceId: string,
    userId: string,
    minRole: WorkspaceRole,
    request?: NextRequest
) {
    const access = await requireWorkspaceAccess(workspaceId, userId, request);

    if (!hasMinimumRole(access.role, minRole)) {
        throw new ApiError(403, `Requires ${minRole} role or higher`);
    }

    return access;
}

/**
 * Check if a role meets the minimum role requirement.
 */
const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
    OWNER: 4,
    ADMIN: 3,
    MEMBER: 2,
    VIEWER: 1,
};

export function hasMinimumRole(
    userRole: WorkspaceRole,
    requiredRole: WorkspaceRole
): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Require the user to be a system admin.
 * Throws ApiError(403) if not admin.
 */
export async function requireAdmin() {
    const user = await requireAuth();

    if (user.role !== 'ADMIN') {
        throw new ApiError(403, 'Admin access required');
    }

    return user;
}

// ============================================
// RLS Context Helpers
// ============================================

/**
 * Run `fn` inside an RLS context scoped to a specific workspace.
 * Use this in route handlers after calling requireWorkspaceAccess() to ensure
 * all downstream Prisma queries and PostgreSQL policies are tenant-scoped.
 *
 * Example:
 *   const user = await requireAuth();
 *   const { workspace, role } = await requireWorkspaceAccess(workspaceId, user.id, request);
 *   return runWithWorkspaceRLS(workspace.id, user, async () => {
 *     return apiSuccess(await AssetService.list());
 *   });
 */
export function runWithWorkspaceRLS<T>(
    workspaceId: string,
    user: { id: string; role: string },
    fn: () => Promise<T>
): Promise<T> {
    return withRLSContext(
        { workspaceId, userId: user.id, isAdmin: user.role === 'ADMIN' },
        fn
    );
}

/**
 * Run `fn` inside an RLS context scoped to a user only (no workspace).
 * Useful for account-level endpoints like /api/account/profile.
 */
export function runWithUserRLS<T>(
    user: { id: string; role: string },
    fn: () => Promise<T>
): Promise<T> {
    return withRLSContext(
        { workspaceId: null, userId: user.id, isAdmin: user.role === 'ADMIN' },
        fn
    );
}

/**
 * Higher-order handler that automatically:
 *   1. Authenticates the user
 *   2. Verifies workspace membership
 *   3. Wraps the handler in an RLS context
 *
 * The callback receives the resolved auth data — no need to call
 * requireAuth() / requireWorkspaceAccess() inside the handler.
 *
 * Usage:
 *   export const GET = withWorkspaceHandler(
 *     async (request, { workspaceId }, { user, role }) => {
 *       return apiSuccess(await AssetService.list());
 *     }
 *   );
 */
export function withWorkspaceHandler<TParams extends { params: Promise<{ id: string }> }>(
    handler: (
        request: NextRequest,
        routeCtx: TParams,
        auth: {
            user: Awaited<ReturnType<typeof requireAuth>>;
            workspace: Awaited<ReturnType<typeof requireWorkspaceAccess>>['workspace'];
            membership: Awaited<ReturnType<typeof requireWorkspaceAccess>>['membership'];
            role: WorkspaceRole;
        }
    ) => Promise<Response>
) {
    return withErrorHandler(async (request: NextRequest, routeCtx: TParams) => {
        const user = await requireAuth();
        const { id: workspaceId } = await routeCtx.params;
        const { workspace, membership, role } = await requireWorkspaceAccess(
            workspaceId,
            user.id,
            request
        );
        return withRLSContext(
            { workspaceId: workspace.id, userId: user.id, isAdmin: user.role === 'ADMIN' },
            () => handler(request, routeCtx, { user, workspace, membership, role })
        );
    });
}

// ============================================
// Cron & Agent Helpers
// ============================================

/**
 * Higher-order handler for cron job endpoints.
 * Verifies the CRON_SECRET bearer token (timing-safe) and wraps the handler
 * in an admin RLS context so cross-workspace queries are unrestricted.
 *
 * Usage:
 *   export const POST = withCronHandler(async (request) => {
 *     await SomeService.processAll();
 *     return apiSuccess({ ok: true });
 *   });
 */
export function withCronHandler(
    handler: (request: NextRequest) => Promise<Response>
) {
    return withErrorHandler(async (request: NextRequest) => {
        const cronSecret = process.env.CRON_SECRET;
        const authHeader =
            request.headers.get('Authorization') ||
            request.headers.get('authorization');

        if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
            throw new ApiError(401, 'Unauthorized');
        }

        const expected = `Bearer ${cronSecret}`;
        if (
            authHeader.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
        ) {
            throw new ApiError(401, 'Unauthorized');
        }

        // Cron jobs process all workspaces — run with admin bypass
        return withRLSContext(
            { workspaceId: null, userId: 'system', isAdmin: true },
            () => handler(request)
        );
    });
}

/**
 * Resolve an agent connection from its raw auth token.
 * Returns the agent id and workspaceId for use in downstream RLS context.
 * Throws ApiError(401) if the token is invalid.
 *
 * Note: this lookup intentionally runs outside any workspace RLS context
 * so the initial token→workspace resolution succeeds.  Once workspaceId is
 * known, callers should wrap further operations in runWithWorkspaceRLS().
 */
export async function requireAgentContext(
    authToken: string
): Promise<{ id: string; workspaceId: string }> {
    const hashed = hashAgentToken(authToken);
    const agent = await prisma.agentConnection.findUnique({
        where: { authToken: hashed },
        select: { id: true, workspaceId: true },
    });
    if (!agent) throw new ApiError(401, 'Invalid auth token');
    return agent;
}

// ============================================
// Route Handler Wrapper
// ============================================

/**
 * Wraps an API route handler with error handling.
 * Catches ApiError and returns standardized responses.
 * 
 * Usage:
 * export const GET = withErrorHandler(async (request, context) => {
 *     const user = await requireAuth();
 *     return apiSuccess({ user });
 * });
 */
export function withErrorHandler<T extends unknown[]>(
    handler: (...args: T) => Promise<Response>
) {
    return async (...args: T): Promise<Response> => {
        try {
            return await handler(...args);
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                return apiError(error.statusCode, error.message);
            }

            if (error instanceof ValidationError) {
                return apiError(400, error.message, error.toJSON().details);
            }

            if (error instanceof ZodError) {
                // Build a user-friendly message from the first validation error
                const firstIssue = error.errors[0];
                const fieldName = firstIssue?.path?.join('.') || 'input';
                const friendlyMessage = firstIssue?.message || 'Please check your input';
                // e.g. "Password must contain at least one uppercase letter"
                const userMessage = fieldName && fieldName !== 'input'
                    ? `${friendlyMessage}`
                    : friendlyMessage;
                return apiError(400, userMessage);
            }

            // Handle Prisma validation errors (invalid enum values, invalid arguments)
            if (error instanceof Prisma.PrismaClientValidationError) {
                return apiError(400, 'Please check your input and try again');
            }

            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    // Extract the field name from the meta if available
                    const target = (error.meta?.target as string[] | undefined);
                    if (target?.includes('email')) {
                        return apiError(409, 'An account with this email already exists');
                    }
                    return apiError(409, 'This record already exists');
                }
                if (error.code === 'P2025') {
                    return apiError(404, 'The requested resource was not found');
                }
                return apiError(400, 'Unable to process your request');
            }

            // Report unexpected errors to Sentry for production monitoring
            Sentry.captureException(error);
            logError('API error', error);

            return apiError(500, 'Internal server error');
        }
    };
}
