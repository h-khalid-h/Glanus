/**
 * POST /api/auth/login
 *
 * Custom login endpoint that replaces direct NextAuth signIn for credentials.
 * Issues both:
 *   - Access token (short-lived JWT, 15 min) as NextAuth session cookie
 *   - Refresh token (long-lived, 7 days) as httpOnly cookie
 *
 * This gives us full control over token lifecycle, rotation, and revocation.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authPrisma } from '@/lib/auth/db';
import { prisma } from '@/lib/db';
import { createRefreshToken } from '@/lib/auth/tokens';
import {
    encodeAccessToken,
    getSessionCookieName,
    REFRESH_COOKIE_NAME,
    getRefreshCookieOptions,
    getAccessCookieOptions,
} from '@/lib/auth/jwt-helpers';
import { withRateLimit } from '@/lib/security/rateLimit';
import { logInfo, logWarn } from '@/lib/logger';
import {
    logFailedLogin,
    logSuccessfulLogin,
    logAccountLockout,
} from '@/lib/security/audit';

// Reuse lockout logic from auth.ts via imports (or inline minimally)
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOCKOUT_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30') * 60 * 1000;
const LOCKOUT_DURATION_S = Math.ceil(LOCKOUT_DURATION_MS / 1000);

// --- Account lockout (shared with lib/auth.ts — uses same Redis keys) ---
let lockoutRedis: RedisClientType | null = null;
let lockoutRedisReady = false;

async function getLockoutRedis(): Promise<RedisClientType | null> {
    if (!process.env.REDIS_URL) return null;
    if (lockoutRedis && lockoutRedisReady) return lockoutRedis;
    try {
        lockoutRedis = createClient({
            url: process.env.REDIS_URL,
            socket: { reconnectStrategy: false, connectTimeout: 3000 },
        }) as RedisClientType;
        lockoutRedis.on('error', () => { lockoutRedisReady = false; });
        lockoutRedis.on('ready', () => { lockoutRedisReady = true; });
        await lockoutRedis.connect();
        return lockoutRedis;
    } catch {
        return null;
    }
}

const memoryLockout = new Map<string, { count: number; lockedUntil?: number }>();

async function isAccountLocked(email: string): Promise<boolean> {
    const redis = await getLockoutRedis();
    if (redis) {
        try {
            const raw = await redis.get(`lockout:${email}`);
            if (!raw) return false;
            const data = JSON.parse(raw) as { count: number; lockedUntil?: number };
            if (!data.lockedUntil) return false;
            if (Date.now() > data.lockedUntil) { await redis.del(`lockout:${email}`); return false; }
            return true;
        } catch { /* fall through */ }
    }
    const m = memoryLockout.get(email);
    if (!m?.lockedUntil) return false;
    if (Date.now() > m.lockedUntil) { memoryLockout.delete(email); return false; }
    return true;
}

async function recordFailedAttempt(email: string): Promise<number> {
    const mem = memoryLockout.get(email) || { count: 0 };
    mem.count += 1;
    if (mem.count >= MAX_LOGIN_ATTEMPTS) mem.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    memoryLockout.set(email, mem);

    const redis = await getLockoutRedis();
    if (redis) {
        try {
            const raw = await redis.get(`lockout:${email}`);
            const cur = raw ? JSON.parse(raw) as { count: number; lockedUntil?: number } : { count: 0 };
            cur.count += 1;
            if (cur.count >= MAX_LOGIN_ATTEMPTS) cur.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
            await redis.set(`lockout:${email}`, JSON.stringify(cur), { EX: LOCKOUT_DURATION_S });
            return Math.max(cur.count, mem.count);
        } catch { /* in-memory fallback above */ }
    }
    return mem.count;
}

async function resetLoginAttempts(email: string): Promise<void> {
    const redis = await getLockoutRedis();
    if (redis) { try { await redis.del(`lockout:${email}`); return; } catch { /* fall through */ } }
    memoryLockout.delete(email);
}

// --- Schema ---
const loginSchema = z.object({
    email: z.string().email().transform((v) => v.toLowerCase().trim()),
    password: z.string().min(1),
});

export async function POST(request: NextRequest) {
    try {
        return await handleLogin(request);
    } catch (err) {
        logWarn('[AUTH] Unhandled login error', { error: err instanceof Error ? err.message : String(err) });
        return NextResponse.json(
            { error: 'An unexpected error occurred. Please try again.' },
            { status: 500 }
        );
    }
}

async function handleLogin(request: NextRequest): Promise<Response> {
    // Rate limit
    const rlResponse = await withRateLimit(request, 'api');
    if (rlResponse) return rlResponse;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.errors[0]?.message || 'Invalid input' },
            { status: 400 }
        );
    }

    const { email, password } = parsed.data;
    const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Account lockout check
    if (await isAccountLocked(email)) {
        await logAccountLockout(email, ipAddress, MAX_LOGIN_ATTEMPTS);
        return NextResponse.json(
            { error: 'Account is locked due to too many failed login attempts. Please try again later.' },
            { status: 429 }
        );
    }

    // Find user
    const user = await authPrisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
        await logFailedLogin(email, ipAddress, userAgent, 'Invalid credentials');
        await recordFailedAttempt(email);
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        const attempts = await recordFailedAttempt(email);
        await logFailedLogin(email, ipAddress, userAgent, `Invalid password (attempt ${attempts}/${MAX_LOGIN_ATTEMPTS})`);
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            await logAccountLockout(email, ipAddress, attempts);
            return NextResponse.json(
                { error: 'Too many failed attempts. Account has been locked for 30 minutes.' },
                { status: 429 }
            );
        }
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Success — reset lockout
    await resetLoginAttempts(email);
    await logSuccessfulLogin(user.id, email, ipAddress, userAgent);

    // Create refresh token + session
    // Wrap in try-catch so auth still succeeds even if the refresh-token tables
    // haven't been migrated yet — the user gets a standard NextAuth session.
    let refreshResult: Awaited<ReturnType<typeof createRefreshToken>> | null = null;
    try {
        refreshResult = await createRefreshToken({
            userId: user.id,
            ipAddress,
            userAgent,
        });
    } catch (err) {
        logWarn('[AUTH] Could not create refresh token (missing migration?)', {
            error: err instanceof Error ? err.message : String(err),
        });
    }

    // Encode access token
    const accessJwt = await encodeAccessToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isStaff: user.isStaff,
        sid: refreshResult?.sessionId,
        mustChangePassword: user.mustChangePassword ?? false,
    });

    // Audit log (non-fatal)
    try {
        await prisma.auditLog.create({
            data: {
                action: 'USER_LOGIN',
                resourceType: 'User',
                resourceId: user.id,
                userId: user.id,
                ipAddress,
                metadata: {
                    loginTime: new Date().toISOString(),
                    userAgent,
                    sessionId: refreshResult?.sessionId,
                },
            },
        });
    } catch (err) {
        logWarn('[AUTH] Audit log failed', { error: err instanceof Error ? err.message : String(err) });
    }

    logInfo(`[AUTH] User ${user.email} logged in (session: ${refreshResult?.sessionId ?? 'none'})`);

    // Build response
    const response = NextResponse.json({
        ok: true,
        forcePasswordReset: user.mustChangePassword ?? false,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isStaff: user.isStaff,
            emailVerified: user.emailVerified,
            onboardingCompleted: user.onboardingCompleted,
        },
    });

    // Set cookies
    response.cookies.set(getSessionCookieName(), accessJwt, getAccessCookieOptions());
    if (refreshResult) {
        response.cookies.set(REFRESH_COOKIE_NAME, refreshResult.plaintext, getRefreshCookieOptions());
    }

    return response;
}
