/**
 * Shared Authentication & Authorization Middleware
 * 
 * Eliminates repeated auth boilerplate from every API route.
 * Provides reusable functions for session validation, 
 * workspace access, and role-based permission checks.
 */

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { ValidationError } from '@/lib/validation';
import type { WorkspaceRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/nextjs';

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

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) {
        throw new ApiError(401, 'User not found');
    }

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
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
            subscription: true,
            members: {
                where: { userId },
            },
            ztnaPolicies: {
                where: { isEnabled: true }
            }
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

    return {
        workspace,
        membership,
        role: effectiveRole,
    };
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
                return apiError(400, 'Validation failed', error.errors);
            }

            // Handle Prisma validation errors (invalid enum values, invalid arguments)
            if (error instanceof Prisma.PrismaClientValidationError) {
                return apiError(400, 'Invalid data provided');
            }

            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    return apiError(409, 'Resource already exists');
                }
                if (error.code === 'P2025') {
                    return apiError(404, 'Resource not found');
                }
                return apiError(400, error.message || 'Database error');
            }

            // Report unexpected errors to Sentry for production monitoring
            Sentry.captureException(error);
            logError('API error', error);

            return apiError(500, 'Internal server error');
        }
    };
}
