import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withCronHandler } from '@/lib/api/withAuth';
import { ScriptScheduleService } from '@/lib/services/ScriptScheduleService';

/**
 * POST /api/cron/scripts
 * Background job to process scheduled scripts.
 * Protected by CRON_SECRET bearer token (timing-safe comparison).
 */
export const POST = withCronHandler(async (_request: NextRequest) => {
    const stats = await ScriptScheduleService.evaluateSchedules();
    return apiSuccess({ success: true, stats, timestamp: new Date().toISOString() });
});

/**
 * GET /api/cron/scripts
 * Get cron job status/info (for debugging).
 */
export const GET = withCronHandler(async (_request: NextRequest) => {
    const status = await ScriptScheduleService.getCronStatus();
    return apiSuccess({ ...status, timestamp: new Date().toISOString() });
});
