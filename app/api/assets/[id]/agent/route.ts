import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { AssetAssignmentService } from '@/lib/services/AssetAssignmentService';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/assets/[id]/agent - Get agent connection for asset
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: assetId } = await params;
    const user = await requireAuth();
    const agentConnection = await AssetAssignmentService.getLinkedAgent(assetId, user.id);
    return apiSuccess(agentConnection);
});
