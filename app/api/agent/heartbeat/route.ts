import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AgentService } from '@/lib/services/AgentService';

const heartbeatSchema = z.object({
    agentId: z.string().optional(),
    authToken: z.string(),
    metrics: z.object({
        cpu: z.number().min(0).max(100),
        cpuTemp: z.number().optional(),
        ram: z.number().min(0).max(100),
        ramUsed: z.number(),
        ramTotal: z.number(),
        disk: z.number().min(0).max(100),
        diskUsed: z.number(),
        diskTotal: z.number(),
        networkUp: z.number(),
        networkDown: z.number(),
        topProcesses: z.array(z.object({
            name: z.string(),
            cpu: z.number(),
            ram: z.number(),
            pid: z.number().optional(),
        })).optional(),
    }),
});

export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await withRateLimit(request, 'api');
        if (rateLimitResponse) return rateLimitResponse;

        const body = await request.json();
        const data = heartbeatSchema.parse(body);

        const result = await AgentService.processHeartbeat(data.authToken, data.metrics);

        return apiSuccess({
            status: 'ok',
            agentId: result.agentId,
            commands: result.commands,
        });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return apiError(400, 'Validation failed', error.errors);
        }
        const err = error as { statusCode?: number; message?: string };
        if (err.statusCode) return apiError(err.statusCode, err.message || 'Error');
        logError('Agent heartbeat failed', error);
        return apiError(500, 'Failed to process heartbeat');
    }
}
