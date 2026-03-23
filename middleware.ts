/**
 * Next.js Security Middleware
 * 
 * Enforces security policies on all requests:
 * - Applies security headers
 * - Validates CSRF tokens on mutations
 * - Logs security events
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSecurityHeaders } from './lib/security/headers';
import { getToken } from 'next-auth/jwt';
// Edge-compatible logger (middleware runs in edge runtime — no Node.js modules)
const logWarn = (message: string) => console.warn(`[Middleware] ${message}`);

// Routes that don't need CSRF protection
const CSRF_EXEMPT_PATHS = [
    '/api/auth/',        // NextAuth handles its own CSRF
    '/api/webhooks/',    // Webhooks use signature verification
    '/api/agent/',       // Agent endpoints use per-request token auth (not session-based)
    '/api/health',       // Health check
    '/api/ready',        // Readiness probe
    '/api/cron',         // Cron jobs use Bearer tokens natively
];

// Public routes (no authentication required)
const PUBLIC_PATHS = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/_next',
    '/favicon.ico',
    '/monitoring',       // Sentry
    '/api/health',
    '/api/ready',
    '/api/auth/',        // NextAuth + custom auth endpoints
    '/api/csrf',         // CSRF token endpoint
    '/api/partners',     // Public partner directory
    '/api/invitations',  // Invitation verification (token-based)
    '/api/cron',         // Bypasses NextAuth (managed by CRON_SECRET)
];

/**
 * Timing-safe string comparison (edge-runtime compatible)
 */
function safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const encoder = new TextEncoder();
    const bufA = encoder.encode(a);
    const bufB = encoder.encode(b);
    // Constant-time comparison without Node.js crypto
    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
        result |= bufA[i] ^ bufB[i];
    }
    return result === 0;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const requestId = crypto.randomUUID();

    // Skip middleware for Next.js internal routes and static files
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)
    ) {
        return NextResponse.next();
    }

    // 1. Authentication Check (Defense-in-Depth)
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path) || pathname === '/');

    if (!token && !isPublicPath) {
        logWarn(`[Auth] Unauthenticated access blocked: ${pathname} [ReqID: ${requestId}]`);

        // Return 401 JSON for API routes instead of redirecting to login page
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401, headers: { 'X-Request-Id': requestId } }
            );
        }

        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Create response with security headers
    const response = NextResponse.next();
    const securityHeaders = getSecurityHeaders(request);

    // Apply security headers to all responses
    for (const [key, value] of Object.entries(securityHeaders)) {
        response.headers.set(key, value);
    }

    // Add request ID for tracing
    response.headers.set('X-Request-Id', requestId);

    // 2. CSRF Protection for state-changing methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        const isExempt = CSRF_EXEMPT_PATHS.some(path => pathname.startsWith(path));

        if (!isExempt) {
            const csrfTokenHeader = request.headers.get('x-csrf-token');
            const csrfTokenCookie = request.cookies.get('csrf-token')?.value;

            // Validate CSRF token presence and match (timing-safe)
            if (!csrfTokenHeader || !csrfTokenCookie || !safeCompare(csrfTokenHeader, csrfTokenCookie)) {
                logWarn(`[Security] CSRF blockage on ${pathname}: ${!csrfTokenHeader ? 'Header missing' : !csrfTokenCookie ? 'Cookie missing' : 'Token mismatch'} [ReqID: ${requestId}]`);
                return NextResponse.json(
                    { error: 'Invalid or missing CSRF token' },
                    { status: 403, headers: { 'X-Request-Id': requestId } }
                );
            }
        }
    }

    return response;
}

// Configure which routes use this middleware
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
