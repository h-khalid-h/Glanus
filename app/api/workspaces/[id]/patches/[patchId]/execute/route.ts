import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { PatchService } from '@/lib/services/PatchService';
import { withRateLimit } from '@/lib/security/rateLimit';

export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; patchId: string }> },
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'ADMIN');

    const { executedCount } = await PatchService.executePatchPolicy(
        params.id,
        params.patchId,
        user.id,
    );

    if (executedCount === 0) {
        return apiSuccess({ count: 0 }, { message: 'No endpoints found requiring this patch.' });
    }

    return apiSuccess(
        { count: executedCount },
        { message: `Successfully deployed patch to ${executedCount} vulnerable endpoints.` },
    );
});
