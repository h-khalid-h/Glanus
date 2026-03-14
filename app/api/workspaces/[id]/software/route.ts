import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NetworkService } from '@/lib/services/NetworkService';

type RouteContext = { params: { id: string } };

export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const workspaceId = params.id;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'VIEWER');
    const software = await NetworkService.getSoftwareInventory(workspaceId);
    return apiSuccess({ software });
});
