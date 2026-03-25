import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspacePartnerService } from '@/lib/services/WorkspacePartnerService';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/workspaces/[id]/assign-partner - Find and assign best matching partner
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const result = await WorkspacePartnerService.assignPartner(workspaceId);
    return apiSuccess(result);
});
