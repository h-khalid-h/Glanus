import { logError, logInfo, logWarn } from '@/lib/logger';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import {
    logFailedLogin,
    logSuccessfulLogin,
    logAccountLockout
} from '@/lib/security/audit';

// ============================================
// Account Lockout — Redis-backed with in-memory fallback
// ============================================

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOCKOUT_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30') * 60 * 1000;
const LOCKOUT_DURATION_S = Math.ceil(LOCKOUT_DURATION_MS / 1000);

// Redis client (shared with rate limiter via same REDIS_URL)
let lockoutRedis: RedisClientType | null = null;
let lockoutRedisReady = false;

async function getLockoutRedis(): Promise<RedisClientType | null> {
    if (!process.env.REDIS_URL) return null;
    if (lockoutRedis && lockoutRedisReady) return lockoutRedis;

    try {
        lockoutRedis = createClient({
            url: process.env.REDIS_URL,
            socket: {
                reconnectStrategy: false,
                connectTimeout: 3000,
            },
        }) as RedisClientType;
        lockoutRedis.on('error', () => { lockoutRedisReady = false; });
        lockoutRedis.on('ready', () => { lockoutRedisReady = true; });
        await lockoutRedis.connect();
        logInfo('Redis connected for account lockout');
        return lockoutRedis;
    } catch {
        logWarn('Redis unavailable for lockout, using in-memory fallback');
        return null;
    }
}

// In-memory fallback (used when Redis is unavailable)
const memoryLockout = new Map<string, { count: number; lockedUntil?: number }>();

function redisKey(email: string): string {
    return `lockout:${email}`;
}

/**
 * Check if account is locked
 */
async function isAccountLocked(email: string): Promise<boolean> {
    const redis = await getLockoutRedis();

    if (redis) {
        try {
            const data = await redis.get(redisKey(email));
            if (!data) return false;
            const parsed = JSON.parse(data) as { count: number; lockedUntil?: number };
            if (!parsed.lockedUntil) return false;
            if (Date.now() > parsed.lockedUntil) {
                await redis.del(redisKey(email));
                return false;
            }
            return true;
        } catch {
            // Fall through to in-memory
        }
    }

    // In-memory fallback
    const attempts = memoryLockout.get(email);
    if (!attempts || !attempts.lockedUntil) return false;
    if (Date.now() > attempts.lockedUntil) {
        memoryLockout.delete(email);
        return false;
    }
    return true;
}

/**
 * Record failed login attempt
 */
async function recordFailedAttempt(email: string): Promise<number> {
    // Always update in-memory as a backstop, then try Redis
    const memAttempts = memoryLockout.get(email) || { count: 0 };
    memAttempts.count += 1;
    if (memAttempts.count >= MAX_LOGIN_ATTEMPTS) {
        memAttempts.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    memoryLockout.set(email, memAttempts);

    const redis = await getLockoutRedis();
    if (redis) {
        try {
            const data = await redis.get(redisKey(email));
            const current = data
                ? (JSON.parse(data) as { count: number; lockedUntil?: number })
                : { count: 0 };

            current.count += 1;
            if (current.count >= MAX_LOGIN_ATTEMPTS) {
                current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
            }

            await redis.set(redisKey(email), JSON.stringify(current), { EX: LOCKOUT_DURATION_S });
            // Return the higher count (defense in depth)
            return Math.max(current.count, memAttempts.count);
        } catch {
            // Redis failed; in-memory already updated above
        }
    }

    return memAttempts.count;
}

/**
 * Reset login attempts on successful login
 */
async function resetLoginAttempts(email: string): Promise<void> {
    const redis = await getLockoutRedis();

    if (redis) {
        try {
            await redis.del(redisKey(email));
            return;
        } catch {
            // Fall through to in-memory
        }
    }

    memoryLockout.delete(email);
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password required');
                }

                const email = credentials.email.toLowerCase().trim();

                // Get IP address and user agent for logging
                const ipAddress = req?.headers?.['x-forwarded-for'] as string ||
                    req?.headers?.['x-real-ip'] as string ||
                    'unknown';
                const userAgent = req?.headers?.['user-agent'] || 'unknown';

                // Check if account is locked
                if (await isAccountLocked(email)) {
                    await logAccountLockout(email, ipAddress, MAX_LOGIN_ATTEMPTS);
                    throw new Error('Account is locked due to too many failed login attempts. Please try again later.');
                }

                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user || !user.password) {
                    await logFailedLogin(email, ipAddress, userAgent, 'Invalid credentials');
                    await recordFailedAttempt(email);
                    throw new Error('Invalid credentials');
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                );

                if (!isPasswordValid) {
                    const attemptCount = await recordFailedAttempt(email);
                    await logFailedLogin(
                        email,
                        ipAddress,
                        userAgent,
                        `Invalid password (attempt ${attemptCount}/${MAX_LOGIN_ATTEMPTS})`
                    );

                    if (attemptCount >= MAX_LOGIN_ATTEMPTS) {
                        await logAccountLockout(email, ipAddress, attemptCount);
                        throw new Error('Too many failed attempts. Account has been locked for 30 minutes.');
                    }

                    throw new Error('Invalid credentials');
                }

                // Successful login - reset attempts
                await resetLoginAttempts(email);

                // Log successful login
                await logSuccessfulLogin(user.id, email, ipAddress, userAgent);

                // Log to audit trail
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
                        },
                    },
                });

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isStaff: user.isStaff,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.isStaff = user.isStaff;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.isStaff = token.isStaff as boolean;
            }
            return session;
        },
        async redirect({ url, baseUrl }) {
            // Check if user needs onboarding
            if (url === baseUrl || url.startsWith(baseUrl + '/login')) {
                try {
                    // Get user from database to check onboarding status
                    const userEmail = (url.includes('?') ? new URL(url).searchParams.get('email') : null);
                    if (userEmail) {
                        const user = await prisma.user.findUnique({
                            where: { email: userEmail },
                            include: {
                                ownedWorkspaces: { take: 1 },
                                workspaceMemberships: { take: 1 },
                            },
                        });

                        // Redirect to onboarding if user has no workspaces and hasn't completed onboarding
                        if (user && !user.onboardingCompleted &&
                            user.ownedWorkspaces.length === 0 &&
                            user.workspaceMemberships.length === 0) {
                            return `${baseUrl}/onboarding`;
                        }
                    }
                } catch (error: unknown) {
                    logError('Redirect callback error', error);
                }
            }

            // Default behavior
            if (url.startsWith('/')) return `${baseUrl}${url}`;
            if (new URL(url).origin === baseUrl) return url;
            return baseUrl;
        },
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 15 * 60, // 15 minutes — short-lived access token; refresh via /api/auth/refresh
    },
    secret: process.env.NEXTAUTH_SECRET,
};

