import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceSubFeatureService } from '@/lib/services/WorkspaceSubFeatureService';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/workspaces/[id]/customer-portal - Create Stripe Customer Portal session
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const result = await WorkspaceSubFeatureService.createCustomerPortalSession(workspaceId);
    return apiSuccess(result);
});
