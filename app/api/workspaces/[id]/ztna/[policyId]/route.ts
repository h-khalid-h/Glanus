import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiDeleted } from '@/lib/api/response';
import { ZtnaService, updateZtnaSchema } from '@/lib/services/ZtnaService';
import { withRateLimit } from '@/lib/security/rateLimit';

type RouteContext = { params: Promise<{ id: string; policyId: string }> };

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, policyId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);

    const result = updateZtnaSchema.parse(await request.json());

    const updated = await ZtnaService.updatePolicy(workspaceId, policyId, result);
    return apiSuccess(updated, { message: 'Zero-Trust Network Policy updated.' });
});

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, policyId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);
    await ZtnaService.deletePolicy(workspaceId, policyId);
    return apiDeleted();
});
