import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { WorkspaceAlertService } from '@/lib/services/WorkspaceAlertService';

const updateAlertRuleSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    metric: z.enum(['CPU', 'RAM', 'DISK', 'OFFLINE']).optional(),
    threshold: z.number().min(0).max(1440).optional(),
    duration: z.number().min(0).max(60).optional(),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
    enabled: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
    notifyWebhook: z.boolean().optional(),
});

// GET /api/workspaces/[id]/alerts/[ruleId]
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string; ruleId: string }> }
) => {
    const { id: workspaceId, ruleId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    try {
        const alertRule = await WorkspaceAlertService.getAlertRule(workspaceId, ruleId);
        return apiSuccess(alertRule);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// PATCH /api/workspaces/[id]/alerts/[ruleId]
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; ruleId: string }> }
) => {
    const { id: workspaceId, ruleId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const body = await request.json();
    const data = updateAlertRuleSchema.parse(body);
    try {
        const alertRule = await WorkspaceAlertService.updateAlertRule(workspaceId, ruleId, user.id, data);
        return apiSuccess(alertRule);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// DELETE /api/workspaces/[id]/alerts/[ruleId]
export const DELETE = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string; ruleId: string }> }
) => {
    const { id: workspaceId, ruleId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    try {
        await WorkspaceAlertService.deleteAlertRule(workspaceId, ruleId, user.id);
        return apiSuccess({ message: 'Alert rule deleted successfully' });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// GET /api/workspaces/[id]/alerts (also handles access-level check for non-admins)
export const HEAD = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string; ruleId: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);
    return apiSuccess({});
});
