import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { updateRelationshipSchema } from '@/lib/schemas/dynamic-asset.schemas';

/**
 * PATCH /api/relationships/{id}
 * Update a relationship
 */
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const user = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();

    // Validate input
    const data = updateRelationshipSchema.parse(body);

    // Check if relationship exists AND user has workspace access via either asset
    const existingRelationship = await prisma.assetRelationship.findFirst({
        where: {
            id,
            OR: [
                { parentAsset: { workspace: { members: { some: { userId: user.id } } } } },
                { childAsset: { workspace: { members: { some: { userId: user.id } } } } },
            ],
        },
        select: { id: true },
    });

    if (!existingRelationship) {
        return apiError(404, 'Relationship not found');
    }

    // Update the relationship
    const relationship = await prisma.assetRelationship.update({
        where: { id },
        data: {
            ...(data.relationshipType && { relationshipType: data.relationshipType }),
            ...(data.quantity !== undefined && { quantity: data.quantity }),
            ...(data.position !== undefined && { position: data.position }),
            ...(data.metadata && { metadata: data.metadata as any }), // Prisma JSON field
        },
        include: {
            parentAsset: {
                select: {
                    id: true,
                    name: true,
                    category: {
                        select: { name: true, icon: true },
                    },
                },
            },
            childAsset: {
                select: {
                    id: true,
                    name: true,
                    category: {
                        select: { name: true, icon: true },
                    },
                },
            },
        },
    });

    return apiSuccess(relationship);
});

/**
 * DELETE /api/relationships/{id}
 * Delete a relationship
 */
export const DELETE = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const user = await requireAuth();
    const { id } = await context.params;

    // Check if relationship exists AND user has workspace access
    const relationship = await prisma.assetRelationship.findFirst({
        where: {
            id,
            OR: [
                { parentAsset: { workspace: { members: { some: { userId: user.id } } } } },
                { childAsset: { workspace: { members: { some: { userId: user.id } } } } },
            ],
        },
        select: {
            id: true,
            relationshipType: true,
            parentAsset: {
                select: { id: true, name: true },
            },
            childAsset: {
                select: { id: true, name: true },
            },
        },
    });

    if (!relationship) {
        return apiError(404, 'Relationship not found');
    }

    // Delete the relationship
    await prisma.assetRelationship.delete({
        where: { id },
    });

    await prisma.auditLog.create({
        data: {
            action: 'RELATIONSHIP_DELETED',
            resourceType: 'AssetRelationship',
            resourceId: id,
            userId: user.id,
            metadata: {
                relationshipType: relationship.relationshipType,
                parentAsset: relationship.parentAsset.name,
                childAsset: relationship.childAsset.name,
            },
        },
    });

    return apiSuccess({
        message: 'Relationship deleted successfully',
        deletedRelationship: relationship,
    });
});

