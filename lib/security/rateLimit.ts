/**
 * Rate Limiting Implementation
 * 
 * Uses Redis for distributed rate limiting when available,
 * falls back to in-memory for development.
 */

import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { logInfo, logWarn, logError } from '@/lib/logger';

// ============================================
// Redis Client (lazy-initialized singleton)
// ============================================

let redisClient: RedisClientType | null = null;
let redisReady = false;

async function getRedisClient(): Promise<RedisClientType | null> {
    if (!process.env.REDIS_URL) return null;
    if (redisClient && redisReady) return redisClient;

    try {
        redisClient = createClient({
            url: process.env.REDIS_URL,
            socket: {
                reconnectStrategy: false,  // Don't auto-reconnect — use in-memory fallback instead
                connectTimeout: 3000,    // Fail fast if Redis is unreachable
            },
        }) as RedisClientType;

        redisClient.on('error', (err) => {
            if (redisReady) {
                logError('Redis client error, falling back to in-memory rate limiting', err);
            }
            redisReady = false;
        });

        redisClient.on('ready', () => {
            redisReady = true;
            logInfo('Redis connected for rate limiting');
        });

        await redisClient.connect();
        return redisClient;
    } catch (error: unknown) {
        logWarn('Redis unavailable, using in-memory rate limiting', { error });
        return null;
    }
}

// ============================================
// Rate Limiter Configurations
// ============================================

// In-memory fallbacks (still needed for dev / Redis failures)
const memoryLoginLimiter = new RateLimiterMemory({
    points: 5,
    duration: 15 * 60,
    blockDuration: 30 * 60,
});

const memoryApiLimiter = new RateLimiterMemory({
    points: 1000,
    duration: 15 * 60,
});

const memoryStrictApiLimiter = new RateLimiterMemory({
    points: 100,
    duration: 15 * 60,
});

// Agent endpoints: tighter limit keyed by agent ID to prevent brute-force
const memoryAgentLimiter = new RateLimiterMemory({
    points: 300,
    duration: 15 * 60,
    blockDuration: 15 * 60,
});

// Redis-backed limiters (created lazily when Redis is available)
let redisLoginLimiter: RateLimiterRedis | null = null;
let redisApiLimiter: RateLimiterRedis | null = null;
let redisStrictApiLimiter: RateLimiterRedis | null = null;
let redisAgentLimiter: RateLimiterRedis | null = null;

async function initRedisLimiters(): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) return false;

    try {
        redisLoginLimiter = new RateLimiterRedis({
            storeClient: client,
            keyPrefix: 'rl:login',
            points: 5,
            duration: 15 * 60,
            blockDuration: 30 * 60,
        });

        redisApiLimiter = new RateLimiterRedis({
            storeClient: client,
            keyPrefix: 'rl:api',
            points: 1000,
            duration: 15 * 60,
        });

        redisStrictApiLimiter = new RateLimiterRedis({
            storeClient: client,
            keyPrefix: 'rl:strict',
            points: 100,
            duration: 15 * 60,
        });

        redisAgentLimiter = new RateLimiterRedis({
            storeClient: client,
            keyPrefix: 'rl:agent',
            points: 300,
            duration: 15 * 60,
            blockDuration: 15 * 60,
        });

        return true;
    } catch {
        return false;
    }
}

// Initialize Redis limiters on first import
let initPromise: Promise<boolean> | null = null;
function ensureInit(): Promise<boolean> {
    if (!initPromise) {
        initPromise = initRedisLimiters();
    }
    return initPromise;
}

// ============================================
// Public API
// ============================================

export type RateLimitType = 'login' | 'api' | 'strict-api' | 'agent';

/**
 * Get the appropriate rate limiter (Redis if available, memory fallback)
 */
async function getRateLimiter(type: RateLimitType) {
    const hasRedis = await ensureInit();

    if (hasRedis) {
        switch (type) {
            case 'login': return redisLoginLimiter!;
            case 'strict-api': return redisStrictApiLimiter!;
            case 'agent': return redisAgentLimiter!;
            case 'api': default: return redisApiLimiter!;
        }
    }

    // Fallback to in-memory
    switch (type) {
        case 'login': return memoryLoginLimiter;
        case 'strict-api': return memoryStrictApiLimiter;
        case 'agent': return memoryAgentLimiter;
        case 'api': default: return memoryApiLimiter;
    }
}

/**
 * Check rate limit for a key (IP address or user ID)
 */
export async function checkRateLimit(
    key: string,
    type: RateLimitType = 'api'
): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
}> {
    const limiter = await getRateLimiter(type);

    try {
        const result = await limiter.consume(key, 1);

        return {
            allowed: true,
            remaining: result.remainingPoints,
            resetAt: new Date(Date.now() + result.msBeforeNext),
        };
    } catch (rejRes: unknown) {
        const msBeforeNext = rejRes !== null && typeof rejRes === 'object' && 'msBeforeNext' in rejRes
            ? (rejRes as { msBeforeNext: number }).msBeforeNext
            : 60000;
        return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(Date.now() + msBeforeNext),
            retryAfter: Math.ceil(msBeforeNext / 1000),
        };
    }
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    const realIp = request.headers.get('x-real-ip');
    const forwarded = request.headers.get('x-forwarded-for');

    if (cfConnectingIp) return cfConnectingIp;
    if (realIp) return realIp;
    if (forwarded) {
        const ips = forwarded.split(',');
        return ips[0].trim();
    }

    return 'unknown-client';
}

/**
 * Rate limit middleware wrapper.
 * Returns a 429 Response if rate-limited, or null to continue.
 */
export async function withRateLimit(
    request: Request,
    type: RateLimitType = 'api',
    customKey?: string
): Promise<Response | null> {
    const key = customKey || getClientIdentifier(request);
    const result = await checkRateLimit(key, type);

    if (!result.allowed) {
        return new Response(
            JSON.stringify({
                success: false,
                error: {
                    code: 429,
                    message: 'Too many requests',
                    retryAfter: result.retryAfter,
                },
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': result.retryAfter?.toString() || '900',
                    'X-RateLimit-Limit': type === 'login' ? '5' : type === 'agent' ? '300' : type === 'strict-api' ? '100' : '1000',
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': result.resetAt.toISOString(),
                },
            }
        );
    }

    return null;
}

/**
 * Get rate limit headers for successful requests
 */
export function getRateLimitHeaders(
    type: RateLimitType,
    remaining: number,
    resetAt: Date
): Record<string, string> {
    const limitMap: Record<RateLimitType, string> = {
        'login': '5',
        'strict-api': '100',
        'agent': '300',
        'api': '1000',
    };
    const limit = limitMap[type] || '1000';

    return {
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetAt.toISOString(),
    };
}

/**
 * Reset rate limit for a key (use for account unlock)
 */
export async function resetRateLimit(
    key: string,
    type: RateLimitType = 'login'
): Promise<void> {
    const limiter = await getRateLimiter(type);
    await limiter.delete(key);
}
