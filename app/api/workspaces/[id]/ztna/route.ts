import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ZtnaService, createZtnaSchema } from '@/lib/services/ZtnaService';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);
    const policies = await ZtnaService.listPolicies(workspaceId);
    return apiSuccess(policies);
});

export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);

    const result = createZtnaSchema.safeParse(await request.json());
    if (!result.success) return apiError(400, 'Invalid ZTNA policy data', result.error.errors);

    const policy = await ZtnaService.createPolicy(workspaceId, result.data);
    return apiSuccess(policy, { message: 'Zero-Trust Network Policy created.' }, 201);
});
