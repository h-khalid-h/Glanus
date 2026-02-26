import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { getOpenAIClient, prompts, defaultModel } from '@/lib/ai/openai';
import { withRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';

const autoCategorizeSchema = z.object({
    description: z.string().min(1, 'Description is required').max(5000, 'Description too long'),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    await requireAuth();
    const body = await request.json();
    const parsed = autoCategorizeSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }
    const { description } = parsed.data;
    // Get OpenAI client (will throw if API key is missing)
    const openai = getOpenAIClient();

    // Call OpenAI to categorize the asset
    const completion = await openai.chat.completions.create({
        model: defaultModel,
        messages: [
            {
                role: 'system',
                content: 'You are an IT asset management expert. Provide precise categorization and suggestions.',
            },
            {
                role: 'user',
                content: prompts.assetCategorization(description),
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return apiSuccess(result);
});
