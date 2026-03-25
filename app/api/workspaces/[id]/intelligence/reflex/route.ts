import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { getRules, saveRule, deleteRule, getActionQueue } from '@/lib/reflex/automation';
import { auditLog } from '@/lib/workspace/auditLog';
import { reflexRuleSchema } from '@/lib/schemas/workspace.schemas';
import { withRateLimit } from '@/lib/security/rateLimit';

/**
 * GET /api/workspaces/[id]/intelligence/reflex
 * GET /api/workspaces/[id]/intelligence/reflex?queue=true
 *
 * Returns automation rules or the action queue for the workspace.
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const workspaceId = params.id;
    const { searchParams } = new URL(request.url);

    if (searchParams.get('queue') === 'true') {
        const queue = await getActionQueue(workspaceId);
        return apiSuccess({ queue });
    }

    const rules = await getRules(workspaceId);
    return apiSuccess({ rules });
});

/**
 * POST /api/workspaces/[id]/intelligence/reflex
 * Body: AutomationRule object
 *
 * Creates or updates an automation rule.
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'ADMIN');

    const workspaceId = params.id;
    const parsed = reflexRuleSchema.parse(await request.json());

    const rule = await saveRule(workspaceId, {
        ...parsed,
        workspaceId,
        createdBy: user.id,
    } as Parameters<typeof saveRule>[1]);

    await auditLog({
        workspaceId,
        userId: user.id,
        action: 'automation.created',
        resourceType: 'AutomationRule',
        resourceId: rule.id,
        details: { name: rule.name, autonomyLevel: rule.autonomyLevel },
    });

    return apiSuccess({ rule }, undefined, 201);
});

/**
 * DELETE /api/workspaces/[id]/intelligence/reflex?ruleId=xxx
 *
 * Deletes an automation rule.
 */
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'ADMIN');

    const workspaceId = params.id;
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');

    if (!ruleId) {
        return apiError(400, 'ruleId query parameter is required');
    }

    await deleteRule(workspaceId, ruleId);

    await auditLog({
        workspaceId,
        userId: user.id,
        action: 'automation.deleted',
        resourceType: 'AutomationRule',
        resourceId: ruleId,
        details: { action: 'deleted' },
    });

    return apiSuccess({ message: 'Rule deleted' });
});
