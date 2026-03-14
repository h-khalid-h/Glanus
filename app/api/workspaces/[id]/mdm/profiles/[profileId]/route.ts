import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { MdmService } from '@/lib/services/MdmService';

type RouteContext = { params: Promise<{ id: string; profileId: string }> };

// GET /api/workspaces/[id]/mdm/profiles/[profileId]
export const GET = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId, profileId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER', req);

    const profiles = await MdmService.getProfiles(workspaceId);
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new ApiError(404, 'MDM profile not found');
    return apiSuccess(profile);
});

// PUT /api/workspaces/[id]/mdm/profiles/[profileId]
export const PUT = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId, profileId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', req);

    const body = await req.json();
    try {
        const profile = await MdmService.updateProfile(workspaceId, profileId, {
            name: body.name,
            description: body.description,
            platform: body.platform,
            profileType: body.profileType,
            configPayload: body.configPayload,
        });
        return apiSuccess(profile, { message: 'MDM profile updated successfully' });
    } catch (error: any) {
        if (error.message.includes('not found')) throw new ApiError(404, 'MDM profile not found');
        throw new ApiError(500, 'Failed to update MDM profile');
    }
});

// DELETE /api/workspaces/[id]/mdm/profiles/[profileId]
export const DELETE = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId, profileId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', req);

    try {
        await MdmService.deleteProfile(workspaceId, profileId);
        return apiSuccess({ deletedId: profileId }, { message: 'MDM profile deleted successfully' });
    } catch (error: any) {
        if (error.message.includes('not found')) throw new ApiError(404, 'MDM profile not found');
        throw new ApiError(500, 'Failed to delete MDM profile');
    }
});
