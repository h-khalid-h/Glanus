import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAgentContext, runWithWorkspaceRLS } from '@/lib/api/withAuth';
import { z } from 'zod';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AgentService } from '@/lib/services/AgentService';
import { hashAgentToken } from '@/lib/security/agent-auth';

const discoverySchema = z.object({
    authToken: z.string(),
    subnet: z.string(),
    devices: z.array(z.object({
        ipAddress: z.string(),
        macAddress: z.string().optional(),
        hostname: z.string().optional(),
        deviceType: z.string().default('UNKNOWN'),
        snmpData: z.record(z.any()).optional(),
    })).max(1000),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const data = discoverySchema.parse(await request.json());
    const rateLimitResponse = await withRateLimit(request, 'agent', `agent:${hashAgentToken(data.authToken)}`);
    if (rateLimitResponse) return rateLimitResponse;

    const agent = await requireAgentContext(data.authToken);
    const result = await runWithWorkspaceRLS(
        agent.workspaceId,
        { id: agent.id, role: 'USER' },
        () => AgentService.processDiscovery(data.authToken, data.subnet, data.devices)
    );
    return apiSuccess(
        { scanId: result.scanId, count: result.count },
        { message: 'Network discovery topology synchronized' },
    );
});
