/**
 * Readiness Probe Endpoint
 *
 * Returns whether the application is ready to accept traffic.
 * Checks all critical dependencies. Returns 503 if not ready.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    const checks: Record<string, string> = {};
    let ready = true;

    // Check database (critical — app cannot function without it)
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

    const status = ready ? 200 : 503;
    return NextResponse.json(
        {
            success: ready,
            data: { ready, checks, timestamp: new Date().toISOString() },
        },
        {
            status,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        }
    );
}
