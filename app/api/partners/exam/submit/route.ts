import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/security/rateLimit';
import { requireAuth, withErrorHandler, runWithUserRLS } from '@/lib/api/withAuth';
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
    const validation = submitExamSchema.parse(await request.json());
    return runWithUserRLS(user, async () => {
        const result = await PartnerExamService.submitExam(user.email!, validation.examId, validation.answers);
        return apiSuccess(result);
    });
});
