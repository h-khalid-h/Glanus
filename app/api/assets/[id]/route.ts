import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { updateAssetSchema } from '@/lib/schemas/asset.schemas';

/**
 * Verify the calling user has access to the asset's workspace.
 * Returns the asset if access is granted, or null.
 */
async function verifyAssetAccess(assetId: string, userId: string) {
    return prisma.asset.findFirst({
        where: {
            id: assetId,
            deletedAt: null,
            workspace: {
                members: { some: { userId } },
            },
        },
    });
}

// GET /api/assets/[id] - Get single asset
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    // Verify workspace membership
    const accessCheck = await verifyAssetAccess(id, user.id);
    if (!accessCheck) {
        return apiError(404, 'Asset not found');
    }

    const asset = await prisma.asset.findFirst({
        where: { id, deletedAt: null },
        include: {
            physicalAsset: true,
            digitalAsset: true,
            assignedTo: {
                select: { id: true, name: true, email: true, role: true },
            },
            assignmentHistory: {
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { assignedAt: 'desc' },
            },
            remoteSessions: {
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { startedAt: 'desc' },
                take: 10,
            },
            aiInsights: {
                orderBy: { createdAt: 'desc' },
                take: 5,
            },
        },
    });

    if (!asset) {
        return apiError(404, 'Asset not found');
    }

    return apiSuccess(asset);
});

// PUT /api/assets/[id] - Update asset
export const PUT = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    const body = await request.json();
    const parsed = updateAssetSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }
    const data = parsed.data;

    // Verify workspace membership
    const existingAsset = await prisma.asset.findFirst({
        where: {
            id,
            deletedAt: null,
            workspace: {
                members: { some: { userId: user.id } },
            },
        },
    });
    if (!existingAsset) {
        return apiError(404, 'Asset not found');
    }

    // Check for duplicate serial number (workspace-scoped)
    if (data.serialNumber && data.serialNumber !== existingAsset.serialNumber) {
        const duplicate = await prisma.asset.findFirst({
            where: {
                serialNumber: data.serialNumber,
                workspaceId: existingAsset.workspaceId,
                id: { not: id },
            },
        });
        if (duplicate) {
            return apiError(409, 'An asset with this serial number already exists');
        }
    }

    const asset = await prisma.asset.update({
        where: { id },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.category !== undefined && { category: data.category as any }),
            ...(data.manufacturer !== undefined && { manufacturer: data.manufacturer }),
            ...(data.model !== undefined && { model: data.model }),
            ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber }),
            ...(data.status !== undefined && { status: data.status as any }),
            ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null }),
            ...(data.purchaseCost !== undefined && { purchaseCost: data.purchaseCost ? parseFloat(String(data.purchaseCost)) : null }),
            ...(data.warrantyUntil !== undefined && { warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil) : null }),
            ...(data.location !== undefined && { location: data.location }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.tags !== undefined && { tags: data.tags }),
        },
        include: {
            assignedTo: { select: { id: true, name: true, email: true } },
        },
    });

    await prisma.auditLog.create({
        data: {
            action: 'ASSET_UPDATED',
            resourceType: 'Asset',
            resourceId: asset.id,
            userId: user.id,
            assetId: asset.id,
            metadata: { assetName: asset.name, changes: data },
        },
    });

    return apiSuccess(asset);
});

// DELETE /api/assets/[id] - Soft delete asset
export const DELETE = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    // Verify workspace membership
    const existingAsset = await prisma.asset.findFirst({
        where: {
            id,
            deletedAt: null,
            workspace: {
                members: { some: { userId: user.id } },
            },
        },
    });
    if (!existingAsset) {
        return apiError(404, 'Asset not found');
    }

    const asset = await prisma.asset.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'RETIRED' },
    });

    await prisma.auditLog.create({
        data: {
            action: 'ASSET_DELETED',
            resourceType: 'Asset',
            resourceId: asset.id,
            userId: user.id,
            assetId: asset.id,
            metadata: { assetName: asset.name },
        },
    });

    return apiSuccess({ message: 'Asset deleted successfully', asset });
});

