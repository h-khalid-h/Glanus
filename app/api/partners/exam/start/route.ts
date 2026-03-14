import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/security/rateLimit';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { PartnerService } from '@/lib/services/PartnerService';

const startExamSchema = z.object({
    level: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']),
});

// POST /api/partners/exam/start
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();
    const body = await request.json();
    const validation = startExamSchema.safeParse(body);
    if (!validation.success) return apiError(400, 'Validation failed', validation.error.errors);

    try {
        const result = await PartnerService.startExam(user.email!, validation.data.level);
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
