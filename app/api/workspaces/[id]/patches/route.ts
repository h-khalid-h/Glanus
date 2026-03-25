import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { PatchService, createPatchPolicySchema } from '@/lib/services/PatchService';
import { withRateLimit } from '@/lib/security/rateLimit';

export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'VIEWER');
    const enrichedPolicies = await PatchService.getPatchPolicies(params.id);
    return apiSuccess(enrichedPolicies);
});

export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'ADMIN');

    const body = createPatchPolicySchema.parse(await request.json());
    const policy = await PatchService.createPatchPolicy(params.id, body);
    return apiSuccess(policy, undefined, 201);
});
