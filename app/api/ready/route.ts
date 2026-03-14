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

    // Check required env vars
    const requiredEnvs = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
    for (const env of requiredEnvs) {
        if (!process.env[env]) {
            checks[`env_${env}`] = 'missing';
            ready = false;
        }
    }

    return apiSuccess({
        ready,
        checks,
        timestamp: new Date().toISOString(),
    },
        { status: ready ? 200 : 503 });
}
