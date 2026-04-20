import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';
import { WorkspaceMemberService } from '@/lib/services/WorkspaceMemberService';

const resetPasswordSchema = z.object({
    password: z.string().min(8).optional(),
});

// POST /api/workspaces/[id]/members/[memberId]/reset-password
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; memberId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, memberId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const body = await request.json().catch(() => ({}));
    const validation = resetPasswordSchema.parse(body);

    const result = await WorkspaceMemberService.resetMemberPassword(
        workspaceId, memberId, user.id, validation.password,
    );

    return apiSuccess({ temporaryPassword: result.temporaryPassword });
});
