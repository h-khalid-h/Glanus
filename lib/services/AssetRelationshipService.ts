import { prisma } from '@/lib/db';
import { Prisma, RelationshipType } from '@prisma/client';

/**
 * AssetRelationshipService — Manages asset-to-asset dependency relationships.
 *
 * Responsibilities:
 *  - listRelationships: query parent/child/both relationships with optional type filter
 *  - createRelationship: validate, circular-check, and persist new relationship
 *  - updateRelationship: partial update of relationship metadata
 *  - deleteRelationship: remove relationship with audit log
 *  - _checkCircularRelationship: BFS cycle detection
 */
export class AssetRelationshipService {
    static async listRelationships(
        assetId: string,
        direction: 'parent' | 'child' | 'both',
        relationshipType?: string | null
    ) {
        const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true, name: true } });
        if (!asset) throw Object.assign(new Error('Asset not found'), { statusCode: 404 });

        const filter: Prisma.AssetRelationshipWhereInput = {
            ...(relationshipType && { relationshipType: relationshipType as RelationshipType }),
        };
        const relatedSelect = {
            select: {
                id: true, name: true, categoryId: true,
                category: { select: { name: true, slug: true, icon: true } },
            },
        };
        const createdBySelect = { select: { id: true, name: true, email: true } };

        // RelWithAsset represents the runtime shape — both parent and child queries include
        // the relevant asset side + createdBy; the union type is safe at runtime.
        type RelWithAsset = Prisma.AssetRelationshipGetPayload<{
            include: { parentAsset: true; childAsset: true; createdBy: true };
        }>;
        let parentRelationships: RelWithAsset[] = [];
        let childRelationships: RelWithAsset[] = [];

        if (direction === 'parent' || direction === 'both') {
            parentRelationships = await prisma.assetRelationship.findMany({
                where: { ...filter, childAssetId: assetId },
                include: { parentAsset: relatedSelect, createdBy: createdBySelect },
                orderBy: { createdAt: 'desc' },
            }) as unknown as RelWithAsset[];
        }

        if (direction === 'child' || direction === 'both') {
            childRelationships = await prisma.assetRelationship.findMany({
                where: { ...filter, parentAssetId: assetId },
                include: { childAsset: relatedSelect, createdBy: createdBySelect },
                orderBy: { createdAt: 'desc' },
            }) as unknown as RelWithAsset[];
        }

        const mapRel = (rel: RelWithAsset, key: 'parentAsset' | 'childAsset') => ({
            id: rel.id, relationshipType: rel.relationshipType, relatedAsset: rel[key],
            quantity: rel.quantity, position: rel.position, metadata: rel.metadata,
            createdBy: rel.createdBy, createdAt: rel.createdAt,
        });

        return {
            asset,
            relationships: {
                parent: parentRelationships.map(r => mapRel(r, 'parentAsset')),
                child: childRelationships.map(r => mapRel(r, 'childAsset')),
            },
            counts: {
                parent: parentRelationships.length,
                child: childRelationships.length,
                total: parentRelationships.length + childRelationships.length,
            },
        };
    }

    static async createRelationship(urlAssetId: string, userId: string, data: {
        parentAssetId: string;
        childAssetId: string;
        relationshipType: string;
        quantity?: number;
        position?: number;
        metadata?: Record<string, unknown>;
    }) {
        if (urlAssetId !== data.parentAssetId && urlAssetId !== data.childAssetId) {
            throw Object.assign(new Error('Asset ID in URL must match either parentAssetId or childAssetId'), { statusCode: 400 });
        }

        const [parentAsset, childAsset] = await Promise.all([
            prisma.asset.findUnique({ where: { id: data.parentAssetId }, select: { id: true, name: true } }),
            prisma.asset.findUnique({ where: { id: data.childAssetId }, select: { id: true, name: true } }),
        ]);
        if (!parentAsset) throw Object.assign(new Error('Parent asset not found'), { statusCode: 404 });
        if (!childAsset) throw Object.assign(new Error('Child asset not found'), { statusCode: 404 });

        // BFS circular check
        const isCircular = await AssetRelationshipService._checkCircularRelationship(data.parentAssetId, data.childAssetId);
        if (isCircular) {
            throw Object.assign(new Error('Cannot create relationship: would create a circular dependency'), { statusCode: 400 });
        }

        const dup = await prisma.assetRelationship.findFirst({
            where: { parentAssetId: data.parentAssetId, childAssetId: data.childAssetId, relationshipType: data.relationshipType as RelationshipType },
        });
        if (dup) throw Object.assign(new Error('A relationship of this type already exists between these assets'), { statusCode: 400 });

        return prisma.assetRelationship.create({
            data: {
                parentAssetId: data.parentAssetId,
                childAssetId: data.childAssetId,
                relationshipType: data.relationshipType as RelationshipType,
                quantity: data.quantity,
                position: data.position != null ? String(data.position) : undefined,
                metadata: data.metadata as Prisma.InputJsonValue,
                createdById: userId,
            },
            include: {
                parentAsset: { select: { id: true, name: true, category: { select: { name: true, icon: true } } } },
                childAsset: { select: { id: true, name: true, category: { select: { name: true, icon: true } } } },
            },
        });
    }

    static async updateRelationship(
        id: string,
        userId: string,
        data: { relationshipType?: string; quantity?: number; position?: unknown; metadata?: unknown }
    ) {
        const existing = await prisma.assetRelationship.findFirst({
            where: {
                id,
                OR: [
                    { parentAsset: { workspace: { members: { some: { userId } } } } },
                    { childAsset: { workspace: { members: { some: { userId } } } } },
                ],
            },
            select: { id: true },
        });
        if (!existing) throw Object.assign(new Error('Relationship not found'), { statusCode: 404 });

        return prisma.assetRelationship.update({
            where: { id },
            data: {
                ...(data.relationshipType ? { relationshipType: data.relationshipType as RelationshipType } : {}),
                ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
                ...(data.position !== undefined ? { position: data.position != null ? String(data.position) : null } : {}),
                ...(data.metadata ? { metadata: data.metadata as Prisma.InputJsonValue } : {}),
            },
            include: {
                parentAsset: { select: { id: true, name: true, category: { select: { name: true, icon: true } } } },
                childAsset: { select: { id: true, name: true, category: { select: { name: true, icon: true } } } },
            },
        });
    }

    static async deleteRelationship(id: string, userId: string) {
        const relationship = await prisma.assetRelationship.findFirst({
            where: {
                id,
                OR: [
                    { parentAsset: { workspace: { members: { some: { userId } } } } },
                    { childAsset: { workspace: { members: { some: { userId } } } } },
                ],
            },
            select: {
                id: true, relationshipType: true,
                parentAsset: { select: { id: true, name: true } },
                childAsset: { select: { id: true, name: true } },
            },
        });
        if (!relationship) throw Object.assign(new Error('Relationship not found'), { statusCode: 404 });

        await prisma.assetRelationship.delete({ where: { id } });

        await prisma.auditLog.create({
            data: {
                action: 'RELATIONSHIP_DELETED', resourceType: 'AssetRelationship', resourceId: id, userId,
                metadata: {
                    relationshipType: relationship.relationshipType,
                    parentAsset: relationship.parentAsset.name,
                    childAsset: relationship.childAsset.name,
                } as Prisma.InputJsonObject,
            },
        });

        return { message: 'Relationship deleted successfully', deletedRelationship: relationship };
    }

    /** BFS cycle detection for asset relationship graphs. */
    static async _checkCircularRelationship(parentAssetId: string, childAssetId: string): Promise<boolean> {
        const visited = new Set<string>();
        const queue = [parentAssetId];
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            if (currentId === childAssetId) return true;
            const parents = await prisma.assetRelationship.findMany({
                where: { childAssetId: currentId }, select: { parentAssetId: true },
            });
            for (const rel of parents) {
                if (!visited.has(rel.parentAssetId)) queue.push(rel.parentAssetId);
            }
        }
        return false;
    }
}
