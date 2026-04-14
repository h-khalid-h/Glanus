/**
 * POST /api/auth/logout
 *
 * Explicitly invalidates the current refresh token family and clears
 * all auth cookies. Unlike NextAuth's built-in signOut (which only
 * clears the client-side cookie), this revokes tokens server-side so
 * they cannot be reused.
 */

import { NextRequest, NextResponse } from 'next/server';
import { hashToken, invalidateFamily } from '@/lib/auth/tokens';
import {
    REFRESH_COOKIE_NAME,
    getSessionCookieName,
} from '@/lib/auth/jwt-helpers';
import { authPrisma } from '@/lib/auth/db';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
    // Best-effort: get user from session for audit logging
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Revoke refresh token family if present
    const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
    if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        const existing = await authPrisma.refreshToken.findUnique({
            where: { tokenHash },
            select: { family: true, userId: true },
        });
        if (existing) {
            await invalidateFamily(existing.family);
        }
    }

    if (userId) {
        const ipAddress =
            request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
            request.headers.get('x-real-ip') ||
            'unknown';

        await prisma.auditLog.create({
            data: {
                action: 'USER_LOGOUT',
                resourceType: 'User',
                resourceId: userId,
                userId,
                ipAddress,
                metadata: { logoutTime: new Date().toISOString() },
            },
        });
        logInfo(`[AUTH] User ${userId} logged out`);
    }

    const response = NextResponse.json({ ok: true });

    // Clear all auth cookies
    response.cookies.delete(REFRESH_COOKIE_NAME);
    response.cookies.delete(getSessionCookieName());
    // NextAuth may use both prefixed and non-prefixed cookie names
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.session-token');
    response.cookies.delete('next-auth.csrf-token');
    response.cookies.delete('__Host-next-auth.csrf-token');

    return response;
}
