import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withCronHandler } from '@/lib/api/withAuth';
import { ScriptScheduleService } from '@/lib/services/ScriptScheduleService';
import { ScriptService } from '@/lib/services/ScriptService';

/**
 * POST /api/cron/scripts
 * Background job to (1) process scheduled scripts and (2) reap stale executions
 * that never reported back from their agent.
 * Protected by CRON_SECRET bearer token (timing-safe comparison).
 */
export const POST = withCronHandler(async (_request: NextRequest) => {
    const [stats, reaped] = await Promise.all([
        ScriptScheduleService.evaluateSchedules(),
        ScriptService.reapStaleExecutions(),
    ]);
    return apiSuccess({ success: true, stats, reaped, timestamp: new Date().toISOString() });
});

/**
 * GET /api/cron/scripts
 * Get cron job status/info (for debugging).
 */
export const GET = withCronHandler(async (_request: NextRequest) => {
    const status = await ScriptScheduleService.getCronStatus();
    return apiSuccess({ ...status, timestamp: new Date().toISOString() });
});
