import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { logError } from '@/lib/logger';
import crypto from 'crypto';
import { ScriptService } from '@/lib/services/ScriptService';

function verifyCronAuth(request: NextRequest): boolean {
    const cronSecret = request.headers.get('Authorization');
    const expectedSecret = process.env.CRON_SECRET;
    const expectedValue = `Bearer ${expectedSecret}`;
    return !!(expectedSecret && cronSecret &&
        cronSecret.length === expectedValue.length &&
        crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedValue)));
}

/**
 * POST /api/cron/scripts
 * Background job to process scheduled scripts.
 */
export async function POST(request: NextRequest) {
    try {
        if (!verifyCronAuth(request)) return apiError(401, 'Unauthorized');
        const stats = await ScriptService.evaluateSchedules();
        return apiSuccess({ success: true, stats, timestamp: new Date().toISOString() });
    } catch (error: unknown) {
        logError('[CRON] Script scheduler critical error', error);
        return apiError(500, error instanceof Error ? error.message : 'Unknown error');
    }
}

/**
 * GET /api/cron/scripts
 * Get cron job status/info (for debugging).
 */
export async function GET(request: NextRequest) {
    try {
        if (!verifyCronAuth(request)) return apiError(401, 'Unauthorized');
        const status = await ScriptService.getCronStatus();
        return apiSuccess({ ...status, timestamp: new Date().toISOString() });
    } catch (error: unknown) {
        return apiError(500, error instanceof Error ? error.message : 'Unknown error');
    }
}
