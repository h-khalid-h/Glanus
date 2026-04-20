/**
 * POST /api/auth/refresh
 *
 * Silent token refresh. Reads the refresh-token from an httpOnly cookie,
 * rotates it (revoke old → issue new), and writes a fresh access-token
 * (NextAuth session cookie) + new refresh-token cookie.
 *
 * On replay detection the entire token family is invalidated and the
 * user must re-authenticate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rotateRefreshToken, TokenError } from '@/lib/auth/tokens';
import {
    REFRESH_COOKIE_NAME,
    encodeAccessToken,
    getSessionCookieName,
    getRefreshCookieOptions,
    getAccessCookieOptions,
} from '@/lib/auth/jwt-helpers';
import { withRateLimit } from '@/lib/security/rateLimit';
import { logWarn } from '@/lib/logger';

export async function POST(request: NextRequest) {
    // Rate limit refresh attempts
    const rateLimitResponse = await withRateLimit(request, 'api');
    if (rateLimitResponse) return rateLimitResponse;

    // During impersonation the session cookie belongs to the target user but the
    // refresh cookie still belongs to the original admin.  Rotating the refresh
    // token would re-issue an admin access token, overwriting the impersonation
    // session.  Return 204 so the client leaves the session untouched.
    if (request.cookies.get('glanus-impersonation')?.value) {
        return new NextResponse(null, { status: 204 });
    }

    const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

    if (!refreshToken) {
        // No refresh cookie: the session was issued without a persistent refresh token
        // (e.g. first login before DB migration, or vanilla NextAuth session).
        // Return 204 so the client knows there is nothing to rotate and should NOT sign out.
        return new NextResponse(null, { status: 204 });
    }

    const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
        const result = await rotateRefreshToken(refreshToken, ipAddress, userAgent);

        // Encode a fresh NextAuth-compatible access token
        const accessJwt = await encodeAccessToken({
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            isStaff: result.user.isStaff,
            sid: result.sessionId,
        });

        const response = NextResponse.json({
            ok: true,
            expiresAt: result.expiresAt.toISOString(),
        });

        // Set access token cookie (NextAuth session cookie)
        response.cookies.set(getSessionCookieName(), accessJwt, getAccessCookieOptions());

        // Set rotated refresh token cookie
        response.cookies.set(REFRESH_COOKIE_NAME, result.plaintext, getRefreshCookieOptions());

        return response;
    } catch (error) {
        if (error instanceof TokenError) {
            logWarn(`[AUTH] Refresh failed: ${error.code} — ${error.message}`);

            const status = error.code === 'REPLAY' ? 403 : 401;
            const response = NextResponse.json(
                { error: error.message, code: error.code },
                { status }
            );

            // Clear cookies on any failure
            response.cookies.delete(REFRESH_COOKIE_NAME);
            response.cookies.delete(getSessionCookieName());

            return response;
        }
        throw error;
    }
}
