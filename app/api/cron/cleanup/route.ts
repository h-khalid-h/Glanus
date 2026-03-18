/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { SystemMaintenanceService } from '@/lib/services/SystemMaintenanceService';
import crypto from 'crypto';

function verifyCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || !authHeader) return false;
    const expected = `Bearer ${expectedSecret}`;
    return (
        authHeader.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    );
}

/**
 * POST /api/cron/cleanup
 *
 * Scheduled job to clean up stale data:
 * - Agent metrics older than 90 days
 * - Audit logs older than 365 days
 * - Resolved alerts older than 90 days
 *
 * Protected by CRON_SECRET bearer token (timing-safe comparison).
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    if (!verifyCronSecret(request)) {
        return apiError(401, 'Unauthorized');
    }

    const results = await SystemMaintenanceService.executeDataCleanup();
    return apiSuccess(results);
});
