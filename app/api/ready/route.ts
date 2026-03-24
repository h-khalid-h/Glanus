import { apiSuccess } from '@/lib/api/response';
/**
 * Readiness Probe Endpoint
 * 
 * Returns whether the application is ready to accept traffic.
 * Checks all critical dependencies.
 */

import { prisma } from '@/lib/db';

export async function GET() {
    const checks: Record<string, string> = {};
    let ready = true;

    // Check database
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = 'ready';
    } catch {
        checks.database = 'not_ready';
        ready = false;
    }

    // Check required env vars (don't expose names publicly)
    const requiredEnvs = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
    const missingCount = requiredEnvs.filter(env => !process.env[env]).length;
    if (missingCount > 0) {
        checks.env = 'incomplete';
        ready = false;
    }

    return apiSuccess({
        ready,
        checks,
        timestamp: new Date().toISOString(),
    }, undefined, ready ? 200 : 503);
}
