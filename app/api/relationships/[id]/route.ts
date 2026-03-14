import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { AssetRelationshipService } from '@/lib/services/AssetRelationshipService';
import { updateRelationshipSchema } from '@/lib/schemas/dynamic-asset.schemas';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/relationships/{id}
 * Update a relationship's type, quantity, position, or metadata.
 */
export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const user = await requireAuth();
    const { id } = await params;
    const data = updateRelationshipSchema.parse(await request.json());
    const relationship = await AssetRelationshipService.updateRelationship(id, user.id, data);
    return apiSuccess(relationship);
});

/**
 * DELETE /api/relationships/{id}
 * Delete a relationship (with audit log).
 */
export const DELETE = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const user = await requireAuth();
    const { id } = await params;
    const result = await AssetRelationshipService.deleteRelationship(id, user.id);
    return apiSuccess(result);
});
