import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/withAuth';
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

export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'api');
    if (rateLimitResponse) return rateLimitResponse;

    const data = heartbeatSchema.parse(await request.json());
    const result = await AgentService.processHeartbeat(data.authToken, data.metrics);
    return apiSuccess({
        status: 'ok',
        agentId: result.agentId,
        commands: result.commands,
    });
});
