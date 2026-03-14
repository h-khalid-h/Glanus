import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AgentService } from '@/lib/services/AgentService';

const commandResultSchema = z.object({
    authToken: z.string(),
    executionId: z.string(),
    status: z.enum(['completed', 'failed', 'timeout']),
    exitCode: z.number().optional(),
    output: z.string().optional(),
    error: z.string().optional(),
    duration: z.number().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = commandResultSchema.parse(body);

        await AgentService.recordCommandResult(data);

        return apiSuccess({ status: 'ok', message: 'Result recorded successfully' });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return apiError(400, 'Validation failed', error.errors);
        }
        const err = error as { statusCode?: number; message?: string };
        if (err.statusCode) return apiError(err.statusCode, err.message || 'Error');
        logError('Agent command result failed', error);
        return apiError(500, 'Failed to record result');
    }
}
