import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AIService } from '@/lib/services/AIService';

const commandSchema = z.object({
    input: z.string().min(1, 'Command input is required').max(4000),
    workspaceId: z.string().min(1, 'Workspace ID is required'),
    currentPath: z.string().optional(),
});

/**
 * POST /api/ai/command — Process a natural language AI command.
 *
 * Rate-limited (strict-api). Requires authentication.
 * Body: { input, workspaceId, currentPath? }
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();
    const data = commandSchema.parse(await request.json());
    await requireWorkspaceAccess(data.workspaceId, user.id, request);

    const result = await AIService.processCommand({
        input: data.input,
        workspaceId: data.workspaceId,
        currentPath: data.currentPath,
        userName: user.name ?? undefined,
        userEmail: user.email ?? undefined,
    });

    return apiSuccess(result);
});
