import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspacePartnerService } from '@/lib/services/WorkspacePartnerService';

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/workspaces/[id]/partner - Remove partner from workspace
export const DELETE = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const result = await WorkspacePartnerService.removePartner(workspaceId, user.email);
    return apiSuccess(result);
});
