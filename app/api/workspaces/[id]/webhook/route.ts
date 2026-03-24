import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspaceWebhookService, WebhookInput } from '@/lib/services/WorkspaceWebhookService';
import { z } from 'zod';

const webhookSchema = z.object({
    url: z.string().url().refine((url) => {
        try {
            const parsed = new URL(url);
            // Only allow HTTPS webhooks
            if (parsed.protocol !== 'https:') return false;
            // Block localhost, private IPs, and metadata services
            const host = parsed.hostname.toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return false;
            if (host === '169.254.169.254' || host === 'metadata.google.internal') return false;
            if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.)/.test(host)) return false;
            return true;
        } catch { return false; }
    }, 'Webhook URL must be a public HTTPS URL'),
    enabled: z.boolean().optional(),
    secret: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET - Get webhook configuration
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const webhook = await WorkspaceWebhookService.getWebhook(workspaceId);
    return apiSuccess({ webhook });
});

// POST - Create or update webhook (ADMIN or higher)
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const data = webhookSchema.parse(await request.json());
    const { webhook, created } = await WorkspaceWebhookService.upsertWebhook(workspaceId, data as WebhookInput);
    return apiSuccess(webhook, undefined, created ? 201 : 200);
});

// DELETE - Delete webhook (ADMIN or higher)
export const DELETE = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const result = await WorkspaceWebhookService.deleteWebhook(workspaceId);
    return apiSuccess(result);
});
