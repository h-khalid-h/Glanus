import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { AssetAssignmentService } from '@/lib/services/AssetAssignmentService';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/assets/[id]/unassign - Unassign asset from user
export const POST = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const user = await requireAuth();
    const asset = await AssetAssignmentService.unassignAsset(id, user.id);
    return apiSuccess(asset);
});
