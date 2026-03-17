import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
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

    await requireAuth();
    const body = await request.json();
    const parsed = autoCategorizeSchema.safeParse(body);
    if (!parsed.success) return apiError(400, parsed.error.errors[0].message);

    const result = await AIService.autoCategorizeAsset(parsed.data.description);
    return apiSuccess(result);
});
