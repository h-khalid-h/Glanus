import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AIService } from '@/lib/services/AIService';

// POST /api/ai/command — Process natural language command
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();
    const body = await request.json();

    try {
        const result = await AIService.processCommand({
            input: body.input,
            workspaceId: body.workspaceId,
            currentPath: body.currentPath,
            userName: user.name ?? undefined,
            userEmail: user.email ?? undefined,
        });
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Failed to process command');
    }
});
