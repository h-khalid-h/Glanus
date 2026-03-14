import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { ScriptService } from '@/lib/services/ScriptService';
import { z } from 'zod';

const deployScriptSchema = z.object({
    targetAgentIds: z.array(z.string()).min(1, 'You must select at least one agent to deploy to.'),
});

type RouteContext = { params: Promise<{ id: string; scriptId: string }> };

/**
 * POST /api/workspaces/[id]/scripts/[scriptId]/deploy
 * Mass Execution — batch-creates ScriptExecution rows for online agents.
 */
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, scriptId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const { targetAgentIds } = deployScriptSchema.parse(await request.json());
    const result = await ScriptService.deployScript(workspaceId, scriptId, user.id, targetAgentIds);
    return apiSuccess(result, { message: `Successfully deployed script to ${result.deployedCount} agents.` }, 201);
});
