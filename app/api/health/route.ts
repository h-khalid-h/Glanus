import { apiSuccess, apiError } from '@/lib/api/response';
/**
 * Health Check Endpoint
 * 
 * Returns system health status including database connectivity.
 * Used for load balancer health checks and monitoring.
 */

import { prisma } from '@/lib/db';

export async function GET() {
    const checks: { status: string; timestamp: string; version: string; uptime: number; environment: string; services: Record<string, { status: string; error?: string }> } = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        services: {},
    };

    let httpStatus = 200;

    // Check database connectivity
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.services.database = { status: 'connected' };
    } catch (error: unknown) {
        checks.services.database = { status: 'disconnected', error: 'Connection failed' };
        checks.status = 'degraded';
        httpStatus = 503;
    }

    return apiSuccess(checks, undefined, httpStatus);
}
