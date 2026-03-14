import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/security/rateLimit';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { PartnerExamService } from '@/lib/services/PartnerExamService';

const submitExamSchema = z.object({
    examId: z.string(),
    answers: z.record(z.number()),
});

// POST /api/partners/exam/submit
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();
    const body = await request.json();
    const validation = submitExamSchema.safeParse(body);
    if (!validation.success) return apiError(400, 'Validation failed', validation.error.errors);

    try {
        const result = await PartnerExamService.submitExam(user.email!, validation.data.examId, validation.data.answers);
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
