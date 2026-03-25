/**
 * Health Check Endpoint
 *
 * Returns system health status including database and Redis connectivity.
 * Used for load balancer health checks and monitoring.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from 'redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    const checks: {
        status: string;
        timestamp: string;
        version: string;
        uptime: number;
        environment: string;
        services: Record<string, { status: string; latencyMs?: number; error?: string }>;
    } = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        services: {},
    };

    let httpStatus = 200;

    // Check database connectivity with latency
    const dbStart = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.services.database = { status: 'connected', latencyMs: Date.now() - dbStart };
    } catch (_error) {
        checks.services.database = { status: 'disconnected', latencyMs: Date.now() - dbStart, error: 'Connection failed' };
        checks.status = 'degraded';
        httpStatus = 503;
    }

    // Check Redis connectivity (if configured)
    if (process.env.REDIS_URL) {
        const redisStart = Date.now();
        let redisClient;
        try {
            redisClient = createClient({
                url: process.env.REDIS_URL,
                socket: { connectTimeout: 2000, reconnectStrategy: false },
            });
            await redisClient.connect();
            await redisClient.ping();
            checks.services.redis = { status: 'connected', latencyMs: Date.now() - redisStart };
            await redisClient.disconnect();
        } catch (_error) {
            checks.services.redis = { status: 'disconnected', latencyMs: Date.now() - redisStart, error: 'Connection failed' };
            // Redis down is degraded, not unhealthy (app can fall back to in-memory)
            if (checks.status === 'healthy') checks.status = 'degraded';
            try { await redisClient?.disconnect(); } catch { /* ignore cleanup errors */ }
        }
    }

    // Memory usage
    const mem = process.memoryUsage();
    checks.services.memory = {
        status: mem.heapUsed / mem.heapTotal > 0.95 ? 'pressure' : 'ok',
        latencyMs: Math.round(mem.heapUsed / 1024 / 1024), // repurpose as MB used
    };

    return NextResponse.json(checks, {
        status: httpStatus,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    });
}
