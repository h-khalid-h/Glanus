import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { AgentService } from '@/lib/services/AgentService';
import { withRateLimit } from '@/lib/security/rateLimit';

const commandResultSchema = z.object({
    authToken: z.string(),
    executionId: z.string(),
    status: z.enum(['completed', 'failed', 'timeout']),
    exitCode: z.number().optional(),
    output: z.string().optional(),
    error: z.string().optional(),
    duration: z.number().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'agent');
    if (rateLimitResponse) return rateLimitResponse;

    const data = commandResultSchema.parse(await request.json());
    await AgentService.recordCommandResult(data);
    return apiSuccess({ status: 'ok', message: 'Result recorded successfully' });
});
