/**
 * JWT Access Token Helpers
 *
 * Wraps NextAuth's JWT encode/decode so that the /api/auth/refresh endpoint
 * can issue a new access-token cookie without going through the full
 * credentials authorize flow.
 *
 * Access tokens (the NextAuth session cookie) are short-lived (15 min).
 * Refresh tokens are long-lived (7 days) and handled by lib/auth/tokens.ts.
 */

import { encode, decode } from 'next-auth/jwt';

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes in seconds

/** The cookie name NextAuth uses in production (secure prefix). */
export function getSessionCookieName(): string {
    const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? process.env.NODE_ENV === 'production';
    return useSecureCookies
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token';
}

export const REFRESH_COOKIE_NAME = 'glanus-refresh-token';

export interface AccessTokenPayload {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    isStaff: boolean;
    /** The AuthSession ID — allows middleware to verify session validity. */
    sid?: string;
}

/**
 * Encode a NextAuth-compatible JWT access token.
 */
export async function encodeAccessToken(payload: AccessTokenPayload): Promise<string> {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('NEXTAUTH_SECRET is required');

    return encode({
        token: {
            id: payload.id,
            email: payload.email,
            name: payload.name,
            role: payload.role,
            isStaff: payload.isStaff,
            sid: payload.sid,
            // NextAuth expects sub for internal tracking
            sub: payload.id,
        },
        secret,
        maxAge: ACCESS_TOKEN_MAX_AGE,
    });
}

/**
 * Decode a NextAuth JWT to extract the payload without full session resolution.
 */
export async function decodeAccessToken(token: string): Promise<AccessTokenPayload | null> {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    try {
        const decoded = await decode({ token, secret });
        if (!decoded || !decoded.id) return null;
        return {
            id: decoded.id as string,
            email: decoded.email as string,
            name: decoded.name as string | null,
            role: decoded.role as string,
            isStaff: decoded.isStaff as boolean,
            sid: decoded.sid as string | undefined,
        };
    } catch {
        return null;
    }
}

/**
 * Cookie options shared across set/delete operations.
 */
export function getRefreshCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
    };
}

export function getAccessCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: ACCESS_TOKEN_MAX_AGE,
    };
}
