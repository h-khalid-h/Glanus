import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { MdmService } from '@/lib/services/MdmService';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workspaces/[id]/mdm/profiles
export const GET = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER', req);

    const url = new URL(req.url);
    const platform = url.searchParams.get('platform');
    const profiles = await MdmService.getProfiles(workspaceId, platform);
    return apiSuccess(profiles);
});

// POST /api/workspaces/[id]/mdm/profiles
export const POST = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', req);

    const body = await req.json();
    if (!body.name || !body.platform || !body.profileType || !body.configPayload) {
        throw new ApiError(400, 'Missing required fields');
    }

    const profile = await MdmService.createProfile(workspaceId, {
        name: body.name,
        description: body.description,
        platform: body.platform,
        profileType: body.profileType,
        configPayload: body.configPayload,
    });

    return apiSuccess(profile, { message: 'MDM profile created successfully' }, 201);
});
