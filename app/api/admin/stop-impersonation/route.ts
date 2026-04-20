import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withAuth';
import { ApiError } from '@/lib/errors';
import { withRateLimit } from '@/lib/security/rateLimit';
import { prisma } from '@/lib/db';
import {
    encodeAccessToken,
    getSessionCookieName,
    getAccessCookieOptions,
} from '@/lib/auth/jwt-helpers';
import * as Sentry from '@sentry/nextjs';

const IMPERSONATION_COOKIE = 'glanus-impersonation';

/**
 * POST /api/admin/stop-impersonation
 *
 * Ends an active impersonation session:
 * 1. Reads the impersonation metadata cookie to identify the original admin
 * 2. Re-issues a session token for the admin
 * 3. Closes the ImpersonationLog record
 * 4. Clears the impersonation cookie
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    // Read impersonation metadata from cookie
    const metaCookie = request.cookies.get(IMPERSONATION_COOKIE)?.value;
    if (!metaCookie) {
        throw new ApiError(400, 'No active impersonation session');
    }

    let meta: {
        adminId: string;
        adminEmail: string;
        adminName: string | null;
        logId: string;
    };

    try {
        meta = JSON.parse(metaCookie);
    } catch {
        throw new ApiError(400, 'Invalid impersonation session data');
    }

    if (!meta.adminId || !meta.logId) {
        throw new ApiError(400, 'Corrupted impersonation session');
    }

    // Verify the admin still exists and is still staff
    const admin = await prisma.user.findUnique({
        where: { id: meta.adminId },
        select: { id: true, email: true, name: true, role: true, isStaff: true },
    });

    if (!admin || !admin.isStaff) {
        throw new ApiError(403, 'Original admin account is no longer valid');
    }

    // Close the impersonation log record
    await prisma.impersonationLog.update({
        where: { id: meta.logId },
        data: { endedAt: new Date() },
    });

    // Log the end event in AuditLog
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    await prisma.auditLog.create({
        data: {
            userId: admin.id,
            action: 'admin.impersonation_ended',
            resourceType: 'user',
            resourceId: meta.adminId,
            details: {
                impersonationLogId: meta.logId,
            },
            ipAddress,
            userAgent,
        },
    });

    Sentry.addBreadcrumb({
        category: 'impersonation',
        message: `Admin ${admin.email} stopped impersonation`,
        level: 'info',
        data: { adminId: admin.id, impersonationLogId: meta.logId },
    });

    // Re-issue a session token for the original admin
    const adminToken = await encodeAccessToken({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isStaff: admin.isStaff,
    });

    const response = apiSuccess({ restored: true, adminEmail: admin.email });

    // Restore the admin session cookie
    response.cookies.set(getSessionCookieName(), adminToken, getAccessCookieOptions());

    // Clear the impersonation metadata cookie
    response.cookies.set(IMPERSONATION_COOKIE, '', {
        httpOnly: false,
        path: '/',
        maxAge: 0,
    });

    return response;
});
