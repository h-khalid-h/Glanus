import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AgentService } from '@/lib/services/AgentService';
import { AgentPlatform } from '@prisma/client';

const registerSchema = z.object({
    assetId: z.string(),
    workspaceId: z.string(),
    hostname: z.string(),
    platform: z.enum(['WINDOWS', 'MACOS', 'LINUX']),
    ipAddress: z.string().optional(),
    macAddress: z.string().optional(),
    agentVersion: z.string(),
    systemInfo: z.object({
        cpu: z.string(),
        ram: z.number(),
        disk: z.number(),
        os: z.string(),
    }).optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();
    const data = registerSchema.parse(await request.json());
    await requireWorkspaceAccess(data.workspaceId, user.id, request);

    const result = await AgentService.registerAgent({
        ...data,
        platform: data.platform as AgentPlatform,
    });
    return apiSuccess(result);
});
