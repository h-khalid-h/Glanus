import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError, apiDeleted } from '@/lib/api/response';
import { WorkspaceSubFeatureService, PatchPolicyUpdateInput } from '@/lib/services/WorkspaceSubFeatureService';
import { z } from 'zod';

const updatePatchPolicySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    targetSoftware: z.string().min(1).max(255).optional(),
    actionScriptId: z.string().optional(),
    isEnabled: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string; patchId: string }> };

export const DELETE = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, patchId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    await WorkspaceSubFeatureService.deletePatchPolicy(workspaceId, patchId);
    return apiDeleted();
});

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, patchId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const result = updatePatchPolicySchema.safeParse(await request.json());
    if (!result.success) return apiError(400, 'Invalid request data', result.error.errors);

    const updated = await WorkspaceSubFeatureService.updatePatchPolicy(workspaceId, patchId, result.data as PatchPolicyUpdateInput);
    return apiSuccess(updated);
});
