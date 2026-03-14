import { apiSuccess, apiError, apiDeleted } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { WorkspaceAlertService } from '@/lib/services/WorkspaceAlertService';

const webhookSchema = z.object({
    url: z.string().url(),
    secret: z.string().optional(),
    enabled: z.boolean().default(true),
});

// GET /api/workspaces/[id]/alerts/webhook
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);
    const webhooks = await WorkspaceAlertService.listWebhooks(workspaceId);
    return apiSuccess({ webhooks });
});

// POST /api/workspaces/[id]/alerts/webhook
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const body = await request.json();
    const data = webhookSchema.parse(body);
    try {
        const { webhook, created } = await WorkspaceAlertService.upsertWebhook(workspaceId, user.id, data);
        return apiSuccess(webhook, undefined, created ? 201 : 200);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// DELETE /api/workspaces/[id]/alerts/webhook?webhookId=...
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const webhookId = new URL(request.url).searchParams.get('webhookId');
    if (!webhookId) return apiError(400, 'Webhook ID is required');
    try {
        await WorkspaceAlertService.deleteWebhook(workspaceId, webhookId, user.id);
        return apiDeleted();
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
