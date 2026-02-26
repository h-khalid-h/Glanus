import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';

// POST /api/assets/[id]/unassign - Unassign asset from user
export const POST = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    const asset = await prisma.asset.findFirst({
        where: {
            id,
            deletedAt: null,
            workspace: {
                members: { some: { userId: user.id } },
            },
        },
        include: { assignedTo: true },
    });

    if (!asset) {
        return apiError(404, 'Asset not found');
    }
    if (!asset.assignedToId) {
        return apiError(400, 'Asset is not currently assigned');
    }

    // Close current assignment in history
    const currentAssignment = await prisma.assignmentHistory.findFirst({
        where: { assetId: id, unassignedAt: null },
    });
    if (currentAssignment) {
        await prisma.assignmentHistory.update({
            where: { id: currentAssignment.id },
            data: { unassignedAt: new Date() },
        });
    }

    const updatedAsset = await prisma.asset.update({
        where: { id },
        data: { assignedToId: null, status: 'AVAILABLE' },
    });

    await prisma.auditLog.create({
        data: {
            action: 'ASSET_UNASSIGNED',
            resourceType: 'Asset',
            resourceId: updatedAsset.id,
            userId: user.id,
            assetId: updatedAsset.id,
            metadata: {
                assetName: updatedAsset.name,
                previouslyAssignedTo: asset.assignedTo?.name,
            },
        },
    });

    return apiSuccess(updatedAsset);
});
