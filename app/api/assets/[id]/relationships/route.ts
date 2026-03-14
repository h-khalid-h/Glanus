import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { AssetRelationshipService } from '@/lib/services/AssetRelationshipService';
import { createRelationshipSchema, relationshipQuerySchema } from '@/lib/schemas/dynamic-asset.schemas';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/assets/{id}/relationships
 * Get all relationships for an asset
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const query = relationshipQuerySchema.parse({
        assetId: id,
        relationshipType: searchParams.get('relationshipType'),
        direction: searchParams.get('direction') || 'both',
        depth: searchParams.get('depth') || '1',
    });

    const result = await AssetRelationshipService.listRelationships(
        id,
        (query.direction as 'parent' | 'child' | 'both') || 'both',
        query.relationshipType,
    );
    return apiSuccess(result);
});

/**
 * POST /api/assets/{id}/relationships
 * Create a new relationship
 */
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const data = createRelationshipSchema.parse(body);
    const relationship = await AssetRelationshipService.createRelationship(id, user.id, data as any);
    return apiSuccess(relationship, undefined, 201);
});
