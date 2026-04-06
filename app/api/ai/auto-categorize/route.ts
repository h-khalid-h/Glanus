import { requireAuth, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';
import { AIService } from '@/lib/services/AIService';

const autoCategorizeSchema = z.object({
    description: z.string().min(1, 'Description is required').max(5000, 'Description too long'),
});

// POST /api/ai/auto-categorize
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();
    const parsed = autoCategorizeSchema.parse(await request.json());
    return runWithUserRLS(user, async () => {
        const result = await AIService.autoCategorizeAsset(parsed.description);
        return apiSuccess(result);
    });
});
