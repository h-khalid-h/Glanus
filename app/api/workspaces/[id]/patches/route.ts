import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { PatchService, createPatchPolicySchema } from '@/lib/services/PatchService';

export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'VIEWER');

    try {
        const enrichedPolicies = await PatchService.getPatchPolicies(params.id);
        return apiSuccess(enrichedPolicies);
    } catch (_error) {
        return apiError(500, 'Failed to fetch patch policies');
    }
});

export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'ADMIN');

    const body = await request.json();
    const result = createPatchPolicySchema.safeParse(body);
    if (!result.success) {
        return apiError(400, 'Invalid request data', result.error.errors);
    }

    try {
        const policy = await PatchService.createPatchPolicy(params.id, result.data);
        return apiSuccess(policy, undefined, 201);
    } catch (error: any) {
        if (error.message.includes('not found')) {
            return apiError(404, error.message);
        }
        return apiError(500, 'Failed to create patch policy');
    }
});
