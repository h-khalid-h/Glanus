import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { MdmService } from '@/lib/services/MdmService';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workspaces/[id]/mdm/assignments
export const GET = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceAccess(workspaceId, user.id, req);

    const url = new URL(req.url);
    const profileId = url.searchParams.get('profileId');

    const assignments = await MdmService.getAssignments(workspaceId, profileId);
    return apiSuccess(assignments);
});

// POST /api/workspaces/[id]/mdm/assignments
export const POST = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceAccess(workspaceId, user.id, req);

    const body = await req.json();
    if (!body.profileId || !body.assetIds) {
        return apiError(400, 'Missing required fields: profileId, assetIds');
    }

    const result = await MdmService.assignProfiles(workspaceId, {
        profileId: body.profileId,
        assetIds: body.assetIds,
    });

    return apiSuccess(result, { message: 'MDM profile assigned successfully' }, 201);
});
