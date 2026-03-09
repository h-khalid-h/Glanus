import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { verifyWorkspaceAccess } from '@/lib/workspace/permissions';
import { prisma } from '@/lib/db';

export const GET = withErrorHandler(async (
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    const access = await verifyWorkspaceAccess(user.email, workspaceId);

    if (!access.allowed) {
        throw new ApiError(403, 'Insufficient workspace permissions');
    }

    const url = new URL(req.url);
    const profileId = url.searchParams.get('profileId');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
        profile: {
            workspaceId
        }
    };

    if (profileId) {
        whereClause.profileId = profileId;
    }

    const assignments = await prisma.mdmAssignment.findMany({
        where: whereClause,
        include: {
            asset: {
                select: { id: true, name: true, serialNumber: true }
            },
            profile: {
                select: { id: true, name: true, platform: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return apiSuccess(assignments);
});

export const POST = withErrorHandler(async (
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    const access = await verifyWorkspaceAccess(user.email, workspaceId);

    if (!access.allowed || (access.role !== 'OWNER' && access.role !== 'ADMIN')) {
        throw new ApiError(403, 'Only Workspace Admins can assign MDM profiles');
    }

    const body = await req.json();
    const { profileId, assetIds } = body;

    if (!profileId || !assetIds || !Array.isArray(assetIds)) {
        throw new ApiError(400, 'Profile ID and an array of Asset IDs are required');
    }

    const profile = await prisma.mdmProfile.findUnique({
        where: { id: profileId }
    });

    if (!profile || profile.workspaceId !== workspaceId) {
        throw new ApiError(404, 'MDM profile not found');
    }

    const assignments = await Promise.all(
        assetIds.map(async (assetId) => {
            // Upsert to handle re-assignments tracking gracefully
            return prisma.mdmAssignment.upsert({
                where: {
                    profileId_assetId: {
                        profileId,
                        assetId
                    }
                },
                update: {
                    status: 'PENDING',
                    errorLog: null,
                },
                create: {
                    profileId,
                    assetId,
                    status: 'PENDING'
                }
            });
        })
    );

    return apiSuccess(assignments, { message: 'Profiles assigned successfully' }, 201);
});
