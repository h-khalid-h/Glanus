import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { WorkspaceAlertService } from '@/lib/services/WorkspaceAlertService';

const alertRuleSchema = z.object({
    name: z.string().min(1).max(255),
    metric: z.enum(['CPU', 'RAM', 'DISK', 'OFFLINE']),
    threshold: z.number().min(0).max(1440),
    duration: z.number().min(0).max(60),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
    notifyEmail: z.boolean().optional(),
    notifyWebhook: z.boolean().optional(),
});

// GET /api/workspaces/[id]/alerts
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);
    const alertRules = await WorkspaceAlertService.listAlertRules(workspaceId);
    return apiSuccess({ alertRules });
});

// POST /api/workspaces/[id]/alerts
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const body = await request.json();
    const data = alertRuleSchema.parse(body);
    const alertRule = await WorkspaceAlertService.createAlertRule(workspaceId, user.id, data);
    return apiSuccess(alertRule, undefined, 201);
});
