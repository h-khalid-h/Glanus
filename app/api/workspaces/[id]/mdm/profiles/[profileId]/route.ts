import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { MdmService } from '@/lib/services/MdmService';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string; profileId: string }> };

const UpdateProfileSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    platform: z.enum(['WINDOWS', 'MACOS', 'LINUX']).optional(),
    profileType: z.string().optional(),
    configPayload: z.unknown().optional(),
});

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
    const rateLimited = await withRateLimit(req, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();
    const { id: workspaceId, profileId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', req);

    const body = UpdateProfileSchema.parse(await req.json());
    const profile = await MdmService.updateProfile(workspaceId, profileId, body);
    return apiSuccess(profile, { message: 'MDM profile updated successfully' });
});

// DELETE /api/workspaces/[id]/mdm/profiles/[profileId]
export const DELETE = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const rateLimited = await withRateLimit(req, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();
    const { id: workspaceId, profileId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', req);

    await MdmService.deleteProfile(workspaceId, profileId);
    return apiSuccess({ deletedId: profileId }, { message: 'MDM profile deleted successfully' });
});
