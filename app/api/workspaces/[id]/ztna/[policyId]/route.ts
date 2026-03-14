import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError, apiDeleted } from '@/lib/api/response';
import { ZtnaService, updateZtnaSchema } from '@/lib/services/ZtnaService';

type RouteContext = { params: Promise<{ id: string; policyId: string }> };

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, policyId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);

    const result = updateZtnaSchema.safeParse(await request.json());
    if (!result.success) return apiError(400, 'Invalid ZTNA policy update data', result.error.errors);

    const updated = await ZtnaService.updatePolicy(workspaceId, policyId, result.data);
    return apiSuccess(updated, { message: 'Zero-Trust Network Policy updated.' });
});

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, policyId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);
    await ZtnaService.deletePolicy(workspaceId, policyId);
    return apiDeleted();
});
