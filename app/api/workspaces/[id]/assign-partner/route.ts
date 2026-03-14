import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspacePartnerService } from '@/lib/services/WorkspacePartnerService';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/workspaces/[id]/assign-partner - Find and assign best matching partner
export const POST = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const result = await WorkspacePartnerService.assignPartner(workspaceId);
    return apiSuccess(result);
});
