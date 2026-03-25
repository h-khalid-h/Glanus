import { apiSuccess } from '@/lib/api/response';
import { ApiError } from '@/lib/errors';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AssetAssignmentService } from '@/lib/services/AssetAssignmentService';
import { prisma } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/assets/[id]/unassign - Unassign asset from user
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id } = await params;
    const user = await requireAuth();

    // Verify user has workspace access to this asset
    const asset = await prisma.asset.findFirst({
        where: { id, deletedAt: null, workspace: { members: { some: { userId: user.id } } } },
        select: { id: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');

    const result = await AssetAssignmentService.unassignAsset(id, user.id);
    return apiSuccess(result);
});
