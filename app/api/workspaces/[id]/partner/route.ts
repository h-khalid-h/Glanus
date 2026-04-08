import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspacePartnerService } from '@/lib/services/WorkspacePartnerService';

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/workspaces/[id]/partner - Remove partner from workspace
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const result = await WorkspacePartnerService.removePartner(workspaceId, user.email);
    return apiSuccess(result);
});
