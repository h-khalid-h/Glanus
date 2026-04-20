import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';
import { WorkspaceMemberService } from '@/lib/services/WorkspaceMemberService';

const updateMemberSchema = z.object({
    role: z.enum(['ADMIN', 'STAFF', 'MEMBER', 'VIEWER']).optional(),
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
});

// PATCH /api/workspaces/[id]/members/[memberId]
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; memberId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, memberId } = await context.params;
    const user = await requireAuth();
    const { workspace } = await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const body = await request.json();
    const validation = updateMemberSchema.parse(body);

    const member = await WorkspaceMemberService.updateMember(
        workspaceId, memberId, user.id, validation, workspace.name,
    );
    return apiSuccess({ member });
});

// DELETE /api/workspaces/[id]/members/[memberId]
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; memberId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, memberId } = await context.params;
    const user = await requireAuth();
    const { workspace } = await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    await WorkspaceMemberService.removeMember(workspaceId, memberId, user.id, workspace.name);
    return apiSuccess({ message: 'Member removed' });
});
