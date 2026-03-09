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
    const platform = url.searchParams.get('platform');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = { workspaceId };
    if (platform) {
        whereClause.platform = platform;
    }

    const profiles = await prisma.mdmProfile.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { assignments: true }
            }
        }
    });

    return apiSuccess(profiles);
});

export const POST = withErrorHandler(async (
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    const access = await verifyWorkspaceAccess(user.email, workspaceId);

    if (!access.allowed || (access.role !== 'OWNER' && access.role !== 'ADMIN')) {
        throw new ApiError(403, 'Only Workspace Admins can create MDM profiles');
    }

    const body = await req.json();
    const { name, description, platform, profileType, configPayload } = body;

    if (!name || !platform || !profileType || !configPayload) {
        throw new ApiError(400, 'Missing required fields');
    }

    const profile = await prisma.mdmProfile.create({
        data: {
            workspaceId,
            name,
            description,
            platform,
            profileType,
            configPayload,
        }
    });

    return apiSuccess(profile, { message: 'MDM profile created successfully' }, 201);
});
