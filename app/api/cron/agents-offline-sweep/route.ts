import { NextRequest } from 'next/server';
import { withCronHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { AgentService } from '@/lib/services/AgentService';

/**
 * POST /api/cron/agents-offline-sweep
 * Marks stale agents offline based on heartbeat age.
 */
export const POST = withCronHandler(async (_request: NextRequest) => {
    const result = await AgentService.markStaleAgentsOffline(5);
    return apiSuccess({
        success: true,
        updated: result.updated,
        staleAfterMinutes: 5,
        timestamp: new Date().toISOString(),
    });
});
