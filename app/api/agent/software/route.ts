import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AgentService } from '@/lib/services/AgentService';

const softwareSchema = z.object({
    authToken: z.string(),
    software: z.array(z.object({
        name: z.string(),
        version: z.string().optional(),
        publisher: z.string().optional(),
        installDate: z.string().optional()
            .transform(v => {
                if (!v) return undefined;
                const d = new Date(v);
                return isNaN(d.getTime()) ? undefined : d;
            }),
        sizeMB: z.number().optional(),
    })).max(5000),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'agent');
    if (rateLimitResponse) return rateLimitResponse;

    const data = softwareSchema.parse(await request.json());
    const result = await AgentService.syncSoftwareInventory(data.authToken, data.software);
    return apiSuccess({ count: result.count }, { message: 'Software inventory synchronized' });
});
