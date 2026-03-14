import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AgentService } from '@/lib/services/AgentService';

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

export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await withRateLimit(request, 'api');
        if (rateLimitResponse) return rateLimitResponse;

        const body = await request.json();
        const data = discoverySchema.parse(body);

        const result = await AgentService.processDiscovery(data.authToken, data.subnet, data.devices);

        return apiSuccess({ scanId: result.scanId, count: result.count }, { message: 'Network discovery topology synchronized' });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return apiError(400, 'Invalid discovery payload configuration', error.errors);
        }
        const err = error as { statusCode?: number; message?: string };
        if (err.statusCode) return apiError(err.statusCode, err.message || 'Error');
        logError('Error processing network discovery telemetry', error);
        return apiError(500, 'Internal Server Error');
    }
}
