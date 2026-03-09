import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { verifyWorkspaceAccess } from '@/lib/workspace/permissions';
import { prisma } from '@/lib/db';

export const PATCH = withErrorHandler(async (
    req: NextRequest,
    context: { params: Promise<{ id: string, profileId: string }> }
) => {
    const user = await requireAuth();
    const { id: workspaceId, profileId } = await context.params;
    const access = await verifyWorkspaceAccess(user.email, workspaceId);

    if (!access.allowed || (access.role !== 'OWNER' && access.role !== 'ADMIN')) {
        throw new ApiError(403, 'Only Workspace Admins can modify MDM profiles');
    }

    const existing = await prisma.mdmProfile.findUnique({
        where: { id: profileId }
    });

    if (!existing || existing.workspaceId !== workspaceId) {
        throw new ApiError(404, 'MDM profile not found');
    }

    const body = await req.json();

    const profile = await prisma.mdmProfile.update({
        where: { id: profileId },
        data: {
            name: body.name,
            description: body.description,
            platform: body.platform,
            profileType: body.profileType,
            configPayload: body.configPayload
        }
    });

    return apiSuccess(profile, { message: 'MDM profile updated successfully' });
});

export const DELETE = withErrorHandler(async (
    req: NextRequest,
    context: { params: Promise<{ id: string, profileId: string }> }
) => {
    const user = await requireAuth();
    const { id: workspaceId, profileId } = await context.params;
    const access = await verifyWorkspaceAccess(user.email, workspaceId);

    if (!access.allowed || (access.role !== 'OWNER' && access.role !== 'ADMIN')) {
        throw new ApiError(403, 'Only Workspace Admins can delete MDM profiles');
    }

    const existing = await prisma.mdmProfile.findUnique({
        where: { id: profileId }
    });

    if (!existing || existing.workspaceId !== workspaceId) {
        throw new ApiError(404, 'MDM profile not found');
    }

    await prisma.mdmProfile.delete({
        where: { id: profileId }
    });

    return apiSuccess({ deletedId: profileId }, { message: 'MDM profile deleted successfully' });
});
