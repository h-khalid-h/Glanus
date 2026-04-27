/**
 * Next.js Security Middleware
 * 
 * Enforces security policies on all requests:
 * - Applies security headers
 * - Validates CSRF tokens on mutations
 * - Auth guard: redirects unauthenticated users to /login
 * - RBAC route guards: enforces minimum workspace role on protected routes
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
    '/api/install-linux',  // Agent install scripts (GET only, token in URL)
    '/api/install-windows',
    '/api/install-macos',
    '/api/downloads/',     // Agent binary downloads
];

// Public page routes (no authentication required)
const PUBLIC_PAGE_PATHS = [
    '/',                 // Landing page
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/terms',            // Terms of Service
    '/privacy',          // Privacy Policy
    '/partners',         // Public partner directory
    '/invitations',      // Invitation verification (token-based)
    '/download-agent',   // Agent download page
];

// Public API routes (no authentication required)
const PUBLIC_API_PATHS = [
    '/api/health',
    '/api/ready',
    '/api/auth/',        // NextAuth + custom auth endpoints (prefix match)
    '/api/csrf',         // CSRF token endpoint
    '/api/partners/signup', // Partner signup
    '/api/invitations',    // Invitation verification (token-based)
    '/api/cron/',        // Cron jobs use Bearer tokens (prefix match)
    '/api/agent/',       // Agent endpoints (use their own token auth)
    '/api/install-linux',  // Agent install scripts (token embedded in URL)
    '/api/install-windows',
    '/api/install-macos',
    '/api/downloads/',     // Agent binary downloads (prefix match)
    '/api/plans',          // Plan configs (public pricing info)
];

// Static/SEO files served by Next.js (not static assets)
const STATIC_FILES = [
    '/robots.txt',
    '/sitemap.xml',
    '/sitemap-0.xml',
    '/manifest.json',
    '/manifest.webmanifest',
    '/favicon.ico',
];

// ---------------------------------------------------------------------------
// RBAC Route Guards
// ---------------------------------------------------------------------------

/**
 * Numeric hierarchy for workspace roles — mirrors withAuth.ts ROLE_HIERARCHY.
 * Defined inline here because middleware runs in the Edge Runtime and cannot
 * import from lib/api/withAuth (which has Node.js dependencies).
 */
const MIDDLEWARE_ROLE_LEVELS: Record<string, number> = {
    OWNER: 5,
    ADMIN: 4,
    STAFF: 3,
    MEMBER: 2,
    VIEWER: 1,
};

/**
 * Routes that require the user to have at least the specified workspace role
 * in their active workspace (read from the JWT wRole claim).
 *
 * Add entries here for any protected page routes.
 * The check is prefix-based — /workspaces/manage/members matches
 * any path that starts with that string.
 */
const WORKSPACE_ROUTE_GUARDS: Array<{ prefix: string; minRole: string }> = [
    { prefix: '/workspaces/manage/members',     minRole: 'ADMIN' },
    { prefix: '/workspaces/manage/settings',    minRole: 'ADMIN' },
    { prefix: '/workspaces/manage/billing',     minRole: 'OWNER' },
    { prefix: '/workspaces/manage/integrations',minRole: 'ADMIN' },
];

/**
 * Returns the redirect target when the user's workspace role is insufficient.
 * Always redirects to /dashboard for page routes (no 403 page shown to end users).
 */
function getWorkspaceRoleRedirect(request: NextRequest): URL {
    return new URL('/dashboard', request.url);
}

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

/**
 * Check if a path is public (no auth required)
 */
function isPublicPath(pathname: string): boolean {
    // Static/SEO files
    if (STATIC_FILES.includes(pathname)) return true;

    // Static assets (images, fonts, etc.)
    if (/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot|txt|xml|json|map)$/.test(pathname)) return true;

    // Next.js internals
    if (pathname.startsWith('/_next/')) return true;

    // Sentry/monitoring
    if (pathname.startsWith('/monitoring')) return true;

    // Public page routes (exact match)
    if (PUBLIC_PAGE_PATHS.includes(pathname)) return true;

    // Public page routes that are prefix-based (e.g. /invitations/[token])
    if (pathname.startsWith('/invitations/')) return true;

    // Public partner routes: /partners/signup and /partners/[uuid] (profiles)
    // Private: /partners/me, /partners/dashboard, /partners/earnings, /partners/certification
    if (pathname === '/partners/signup') return true;
    if (pathname.startsWith('/partners/') && /^\/partners\/[0-9a-f-]{36}$/.test(pathname)) return true;

    // Public API routes
    if (PUBLIC_API_PATHS.some(path =>
        pathname === path || (path.endsWith('/') && pathname.startsWith(path))
    )) return true;

    return false;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const requestId = crypto.randomUUID();

    // Skip middleware entirely for Next.js internal routes and static files
    if (
        pathname.startsWith('/_next') ||
        /\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot|map)$/.test(pathname)
    ) {
        return NextResponse.next();
    }

    // 1. Authentication Check (Defense-in-Depth)
    if (!isPublicPath(pathname)) {
        // Agent bearer-token bypass for dual-auth signaling routes.
        // `/api/remote/sessions/:id/signaling` accepts either a user session
        // cookie or an agent bearer token (see `resolveSignalingCaller`).
        // `/api/remote/ice-servers` is fetched by both the browser viewer
        // (cookie-authed) and the Rust agent (Bearer) so it must accept the
        // same dual auth — without this bypass the agent gets 401 from the
        // middleware before its handler can validate the token, and the
        // peer connection ends up with zero ICE servers (host candidates
        // only) which fails on any non-LAN network.
        // Middleware only sees NextAuth JWTs, so a pure-agent request would
        // be 401'd here before the route's dual-auth can run. Let Bearer-only
        // requests through; the route handler re-validates via the RBAC /
        // agent-token check and enforces scoping to the agent's asset.
        const isSignalingRoute = /^\/api\/remote\/sessions\/[^/]+\/signaling$/.test(pathname);
        const isIceServersRoute = pathname === '/api/remote/ice-servers';
        const authHeader = request.headers.get('Authorization');
        const hasBearer = !!authHeader && authHeader.startsWith('Bearer ');
        if ((isSignalingRoute || isIceServersRoute) && hasBearer) {
            return NextResponse.next();
        }

        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

        if (!token) {
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

        // 1a. Forced password reset — block everything except the reset flow
        const mustChangePassword = token.mustChangePassword === true;
        const isForceResetPage = pathname === '/force-reset-password';
        const isForceResetApi = pathname === '/api/auth/force-reset-password';
        const isAuthApi = pathname.startsWith('/api/auth/');
        const isCsrfApi = pathname === '/api/csrf';

        if (mustChangePassword && !isForceResetPage && !isForceResetApi && !isAuthApi && !isCsrfApi) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Password reset required', code: 'FORCE_PASSWORD_RESET' },
                    { status: 403, headers: { 'X-Request-Id': requestId } }
                );
            }
            return NextResponse.redirect(new URL('/force-reset-password', request.url));
        }

        // 1b. Staff-only route enforcement
        const isStaff = token.isStaff === true;
        const isStaffRoute = pathname.startsWith('/super-admin') || pathname.startsWith('/api/admin');
        const isAccountRoute = pathname.startsWith('/account') || pathname.startsWith('/api/account');
        const isApiAuth = pathname.startsWith('/api/auth');

        // During impersonation, the token has isStaff=false but the user needs
        // access to /api/admin/stop-impersonation to end the session.
        const isImpersonating = !!request.cookies.get('glanus-impersonation')?.value;
        const isStopImpersonation = pathname === '/api/admin/stop-impersonation';

        // Staff users must use "Act As" to access workspace/product routes.
        // Direct access is blocked while token.isStaff === true.
        const isAllowedApiRoute = pathname.startsWith('/api/plans') || pathname.startsWith('/api/csrf');

        if (isStaff && !isStaffRoute && !isAccountRoute && !isApiAuth && !isAllowedApiRoute) {
            // Staff users trying to access workspace/product routes directly
            // are redirected to super-admin and must enter via Act As.
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Staff users must use Act As for workspace access' },
                    { status: 403, headers: { 'X-Request-Id': requestId } }
                );
            }
            return NextResponse.redirect(new URL('/super-admin', request.url));
        }

        if (!isStaff && isStaffRoute) {
            // Allow stop-impersonation endpoint during active impersonation
            if (isImpersonating && isStopImpersonation) {
                // Fall through — the endpoint handles its own auth via the impersonation cookie
            } else {
                // Non-staff users cannot access super-admin routes
                if (pathname.startsWith('/api/admin')) {
                    return NextResponse.json(
                        { error: 'Admin access required' },
                        { status: 403, headers: { 'X-Request-Id': requestId } }
                    );
                }
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
        }

        // 1c. RBAC: workspace-level route guards
        // Only page routes are guarded here; API routes rely on requireWorkspaceRole().
        if (!isStaff && !pathname.startsWith('/api/')) {
            const guard = WORKSPACE_ROUTE_GUARDS.find((g) =>
                pathname.startsWith(g.prefix)
            );

            if (guard) {
                // wRole is embedded in the JWT by /api/auth/switch-workspace.
                // If absent the user hasn't selected a workspace yet — deny.
                const wRole = typeof token.wRole === 'string' ? token.wRole : '';
                const userLevel = MIDDLEWARE_ROLE_LEVELS[wRole] ?? 0;
                const requiredLevel = MIDDLEWARE_ROLE_LEVELS[guard.minRole] ?? 99;

                if (userLevel < requiredLevel) {
                    logWarn(
                        `[RBAC] Role insufficient for ${pathname}: need ${guard.minRole}, ` +
                        `got ${wRole || 'none'} [ReqID: ${requestId}]`
                    );
                    return NextResponse.redirect(getWorkspaceRoleRedirect(request));
                }
            }
        }
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
         * - public folder static assets
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
