import { apiSuccess, apiError, apiDeleted } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, requireWorkspaceRole, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';

const webhookSchema = z.object({
    url: z.string().url(),
    secret: z.string().optional(),
    enabled: z.boolean().default(true),
});

// GET - List all notification webhooks for a workspace
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const webhooks = await prisma.notificationWebhook.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        // Don't expose secrets back to the frontend
        select: {
            id: true,
            url: true,
            enabled: true,
            lastSuccess: true,
            lastFailure: true,
            failureCount: true,
            createdAt: true,
            updatedAt: true,
        }
    });

    return apiSuccess({ webhooks });
});

// POST - Create or Update a notification webhook (upsert)
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();

    // Webhook configuration is dangerous; require ADMIN
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const body = await request.json();
    const data = webhookSchema.parse(body);

    // Upsert: update existing webhook for this workspace, or create a new one
    const existing = await prisma.notificationWebhook.findFirst({
        where: { workspaceId },
    });

    const webhook = existing
        ? await prisma.notificationWebhook.update({
            where: { id: existing.id },
            data: {
                url: data.url,
                secret: data.secret,
                enabled: data.enabled,
            },
            select: {
                id: true,
                url: true,
                enabled: true,
                lastSuccess: true,
                lastFailure: true,
                failureCount: true,
                createdAt: true,
                updatedAt: true,
            },
        })
        : await prisma.notificationWebhook.create({
            data: {
                ...data,
                workspaceId,
            },
            select: {
                id: true,
                url: true,
                enabled: true,
                lastSuccess: true,
                lastFailure: true,
                failureCount: true,
                createdAt: true,
                updatedAt: true,
            },
        });

    await prisma.auditLog.create({
        data: {
            workspaceId,
            userId: user.id,
            action: existing ? 'webhook.updated' : 'webhook.created',
            resourceType: 'NotificationWebhook',
            resourceId: webhook.id,
            metadata: { url: webhook.url },
        },
    });

    return apiSuccess(webhook, undefined, existing ? 200 : 201);
});

// DELETE - Remove a webhook configuration
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();

    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const urlParams = new URL(request.url);
    const webhookId = urlParams.searchParams.get('webhookId');

    if (!webhookId) {
        return apiError(400, 'Webhook ID is required');
    }

    const targetWebhook = await prisma.notificationWebhook.findFirst({
        where: { id: webhookId, workspaceId }
    });

    if (!targetWebhook) {
        return apiError(404, 'Webhook not found');
    }

    await prisma.notificationWebhook.delete({
        where: { id: webhookId }
    });

    await prisma.auditLog.create({
        data: {
            workspaceId,
            userId: user.id,
            action: 'webhook.deleted',
            resourceType: 'NotificationWebhook',
            resourceId: webhookId,
            metadata: { url: targetWebhook.url },
        },
    });

    return apiDeleted();
});
