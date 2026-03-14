import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { WorkspaceSubFeatureService } from '@/lib/services/WorkspaceSubFeatureService';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/workspaces/[id]/customer-portal - Create Stripe Customer Portal session
export const POST = withErrorHandler(async (_request: Request, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const result = await WorkspaceSubFeatureService.createCustomerPortalSession(workspaceId);
    return apiSuccess(result);
});
