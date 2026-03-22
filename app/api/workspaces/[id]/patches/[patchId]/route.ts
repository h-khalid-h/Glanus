import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiDeleted } from '@/lib/api/response';
import { PatchService, PatchPolicyUpdateInput } from '@/lib/services/PatchService';
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
    await PatchService.deletePatchPolicy(workspaceId, patchId);
    return apiDeleted();
});

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, patchId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const result = updatePatchPolicySchema.parse(await request.json());

    const updated = await PatchService.updatePatchPolicy(workspaceId, patchId, result as PatchPolicyUpdateInput);
    return apiSuccess(updated);
});
