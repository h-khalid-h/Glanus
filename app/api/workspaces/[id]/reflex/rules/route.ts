import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess } from '@/lib/api/response';
import { getRules, saveRule } from '@/lib/reflex/automation';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';

const triggerSchema = z.object({
    type: z.enum(['metric_threshold', 'alert_fired', 'pattern_detected', 'schedule']),
    metric: z.enum(['cpu', 'ram', 'disk']).optional(),
    operator: z.enum(['gt', 'lt', 'eq']).optional(),
    value: z.number().optional(),
    alertSeverity: z.string().optional(),
    cronExpression: z.string().optional(),
});

const actionSchema = z.object({
    type: z.enum(['run_script', 'send_notification', 'restart_agent', 'create_alert']),
    scriptId: z.string().optional(),
    scriptName: z.string().optional(),
    notificationChannel: z.string().optional(),
    message: z.string().optional(),
    targetAssetId: z.string().optional(),
});

const saveRuleSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Rule name is required').max(255),
    description: z.string().default(''),
    trigger: triggerSchema,
    action: actionSchema,
    autonomyLevel: z.enum(['suggest', 'confirm', 'auto'] as const),
    enabled: z.boolean().default(true),
    cooldownMinutes: z.number().int().min(0).default(60),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/workspaces/[id]/reflex/rules — List automation rules for a workspace.
 */
export const GET = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER', request);
    const rules = await getRules(workspaceId);
    return apiSuccess(rules);
});

/**
 * POST /api/workspaces/[id]/reflex/rules — Create or update an automation rule.
 */
export const POST = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);

    const data = saveRuleSchema.parse(await request.json());
    const isUpdate = !!data.id;

    const rulePayload = {
        id: data.id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        action: data.action,
        autonomyLevel: data.autonomyLevel,
        enabled: data.enabled,
        cooldownMinutes: data.cooldownMinutes,
        createdBy: user.id,
        workspaceId,
    };

    const rule = await saveRule(workspaceId, rulePayload);
    return apiSuccess(rule, { message: 'Automation rule saved successfully' }, isUpdate ? 200 : 201);
});
