import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
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

export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await withRateLimit(request, 'strict-api');
        if (rateLimitResponse) return rateLimitResponse;

        const body = await request.json();
        const data = registerSchema.parse(body);

        const result = await AgentService.registerAgent({
            ...data,
            platform: data.platform as AgentPlatform,
        });

        return apiSuccess(result);
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return apiError(400, 'Validation failed', error.errors);
        }
        const err = error as { statusCode?: number; message?: string };
        if (err.statusCode) return apiError(err.statusCode, err.message || 'Error');
        logError('Agent registration failed', error);
        return apiError(500, 'Failed to register agent');
    }
}
