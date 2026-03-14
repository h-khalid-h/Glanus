import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
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

export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await withRateLimit(request, 'api');
        if (rateLimitResponse) return rateLimitResponse;

        const body = await request.json();
        const data = softwareSchema.parse(body);

        const result = await AgentService.syncSoftwareInventory(data.authToken, data.software);

        return apiSuccess({ count: result.count }, { message: 'Software inventory synchronized' });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return apiError(400, 'Invalid payload', error.errors);
        }
        const err = error as { statusCode?: number; message?: string };
        if (err.statusCode) return apiError(err.statusCode, err.message || 'Error');
        logError('Error synchronizing agent software', error);
        return apiError(500, 'Internal Server Error');
    }
}
