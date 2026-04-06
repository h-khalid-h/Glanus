/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { withCronHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { SystemMaintenanceService } from '@/lib/services/SystemMaintenanceService';

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
export const POST = withCronHandler(async (_request: NextRequest) => {
    const results = await SystemMaintenanceService.executeDataCleanup();
    return apiSuccess(results);
});
