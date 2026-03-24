import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/withAuth';
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

export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'agent');
    if (rateLimitResponse) return rateLimitResponse;

    const data = discoverySchema.parse(await request.json());
    const result = await AgentService.processDiscovery(data.authToken, data.subnet, data.devices);
    return apiSuccess(
        { scanId: result.scanId, count: result.count },
        { message: 'Network discovery topology synchronized' },
    );
});
