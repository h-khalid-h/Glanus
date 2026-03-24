import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { AgentService } from '@/lib/services/AgentService';
import { withRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';

const CheckUpdateSchema = z.object({
    current_version: z.string().min(1, 'current_version is required'),
    platform: z.enum(['WINDOWS', 'MACOS', 'LINUX'], {
        errorMap: () => ({ message: 'Invalid platform. Must be WINDOWS, MACOS, or LINUX' }),
    }),
});

/**
 * POST /api/agent/check-update
 * Public endpoint (agents are not user-session authenticated — they use bearer tokens at heartbeat).
 * Checks if a newer version of the agent binary is available for the given platform.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'agent');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { current_version, platform } = CheckUpdateSchema.parse(body);
    const update = await AgentService.checkForUpdate(current_version, platform);
    return apiSuccess(update);
});
