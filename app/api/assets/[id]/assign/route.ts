import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { assignAssetSchema } from '@/lib/schemas/asset.schemas';

// POST /api/assets/[id]/assign - Assign asset to user
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    const body = await request.json();
    const parsed = assignAssetSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }
    const { userId, notes } = parsed.data;

    const asset = await prisma.asset.findFirst({
        where: {
            id,
            deletedAt: null,
            workspace: {
                members: { some: { userId: user.id } },
            },
        },
    });
    if (!asset) {
        return apiError(404, 'Asset not found');
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
        return apiError(404, 'User not found');
    }

    // Close previous assignment if exists
    if (asset.assignedToId) {
        const currentAssignment = await prisma.assignmentHistory.findFirst({
            where: { assetId: id, unassignedAt: null },
        });
        if (currentAssignment) {
            await prisma.assignmentHistory.update({
                where: { id: currentAssignment.id },
                data: { unassignedAt: new Date() },
            });
        }
    }

    await prisma.assignmentHistory.create({
        data: { assetId: id, userId, notes: notes || null },
    });

    const updatedAsset = await prisma.asset.update({
        where: { id },
        data: { assignedToId: userId, status: 'ASSIGNED' },
        include: {
            assignedTo: { select: { id: true, name: true, email: true } },
        },
    });

    await prisma.auditLog.create({
        data: {
            action: 'ASSET_ASSIGNED',
            resourceType: 'Asset',
            resourceId: updatedAsset.id,
            userId: user.id,
            assetId: updatedAsset.id,
            metadata: {
                assetName: updatedAsset.name,
                assignedTo: targetUser.name,
                assignedToId: userId,
                notes,
            },
        },
    });

    return apiSuccess(updatedAsset);
});
