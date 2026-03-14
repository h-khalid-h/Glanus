import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NetworkService } from '@/lib/services/NetworkService';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);
    const result = await NetworkService.getNetworkTopology(workspaceId);
    return apiSuccess(result);
});
