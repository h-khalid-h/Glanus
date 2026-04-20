import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { ApiError } from '@/lib/errors';
import { withRateLimit } from '@/lib/security/rateLimit';
import { prisma } from '@/lib/db';
import {
    encodeAccessToken,
    getSessionCookieName,
    getAccessCookieOptions,
} from '@/lib/auth/jwt-helpers';
import * as Sentry from '@sentry/nextjs';

const IMPERSONATION_MAX_AGE = 15 * 60; // 15 minutes
const IMPERSONATION_COOKIE = 'glanus-impersonation';

/**
 * POST /api/admin/act-as
 *
 * Allows a Super Admin to impersonate a workspace owner.
 * Creates a temporary session token with the target user's identity,
 * stores the original admin session for restoration, and logs the event.
 *
 * Body: { workspaceId: string, reason?: string }
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const admin = await requireStaff();

    return runWithUserRLS(admin, async () => {
        const body = await request.json();
        const { workspaceId, reason } = body as { workspaceId?: string; reason?: string };

        if (!workspaceId || typeof workspaceId !== 'string') {
            throw new ApiError(400, 'workspaceId is required');
        }

        // Fetch the workspace and its owner
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: {
                id: true,
                name: true,
                slug: true,
                ownerId: true,
                deletedAt: true,
                owner: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        isStaff: true,
                    },
                },
            },
        });

        if (!workspace || workspace.deletedAt) {
            throw new ApiError(404, 'Workspace not found');
        }

        const targetUser = workspace.owner;

        // Prevent impersonating another super admin (privilege escalation guard)
        if (targetUser.isStaff && targetUser.id !== admin.id) {
            throw new ApiError(403, 'Cannot impersonate another staff member');
        }

        // Prevent self-impersonation (no-op guard)
        if (targetUser.id === admin.id) {
            throw new ApiError(400, 'Cannot impersonate yourself');
        }

        // Create the impersonation access token with the target user's identity
        // but flagged as impersonation via a special claim
        const impersonationToken = await encodeAccessToken({
            id: targetUser.id,
            email: targetUser.email,
            name: targetUser.name,
            role: targetUser.role,
            isStaff: false, // Target is NOT staff — prevent privilege escalation
            wid: workspace.id,
            wRole: 'OWNER',
        });

        // Log the impersonation event in a dedicated audit table
        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
        const userAgent = request.headers.get('user-agent') || undefined;

        const impersonationLog = await prisma.impersonationLog.create({
            data: {
                adminId: admin.id,
                targetUserId: targetUser.id,
                workspaceId: workspace.id,
                ipAddress,
                userAgent,
                reason: reason || null,
            },
        });

        // Also log into the general AuditLog for cross-referencing
        await prisma.auditLog.create({
            data: {
                userId: admin.id,
                workspaceId: workspace.id,
                action: 'admin.impersonation_started',
                resourceType: 'user',
                resourceId: targetUser.id,
                details: {
                    targetUserId: targetUser.id,
                    targetEmail: targetUser.email,
                    impersonationLogId: impersonationLog.id,
                    reason: reason || null,
                },
                ipAddress,
                userAgent,
            },
        });

        // Report to Sentry as breadcrumb for traceability
        Sentry.addBreadcrumb({
            category: 'impersonation',
            message: `Admin ${admin.email} started impersonating ${targetUser.email}`,
            level: 'warning',
            data: {
                adminId: admin.id,
                targetUserId: targetUser.id,
                workspaceId: workspace.id,
                impersonationLogId: impersonationLog.id,
            },
        });

        // Build the response with cookies
        const response = apiSuccess({
            impersonationLogId: impersonationLog.id,
            targetUser: {
                id: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
            },
            workspace: {
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
            },
        });

        const isProduction = process.env.NODE_ENV === 'production';

        // Set the impersonation session token (replaces the normal session cookie)
        response.cookies.set(getSessionCookieName(), impersonationToken, {
            ...getAccessCookieOptions(),
            maxAge: IMPERSONATION_MAX_AGE,
        });

        // Store impersonation metadata in a separate cookie so:
        // 1. The banner component knows we're impersonating
        // 2. We can restore the admin session on stop
        // 3. We can enforce the 15-min expiry
        const impersonationMeta = JSON.stringify({
            adminId: admin.id,
            adminEmail: admin.email,
            adminName: admin.name,
            targetUserId: targetUser.id,
            targetEmail: targetUser.email,
            targetName: targetUser.name,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            workspaceSlug: workspace.slug,
            logId: impersonationLog.id,
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + IMPERSONATION_MAX_AGE * 1000).toISOString(),
        });

        response.cookies.set(IMPERSONATION_COOKIE, impersonationMeta, {
            httpOnly: false, // Readable by the banner component
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: IMPERSONATION_MAX_AGE,
        });

        return response;
    });
});
