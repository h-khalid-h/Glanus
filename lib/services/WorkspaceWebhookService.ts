/**
 * WorkspaceWebhookService — Manages outbound webhook endpoints for workspace event notifications.
 *
 * Responsibilities:
 *  - listWebhooks: return all webhook endpoints configured for a workspace
 *  - createWebhook: register a new endpoint with event filters and secret
 *  - updateWebhook: patch endpoint URL, events, or enabled state
 *  - deleteWebhook: remove a webhook endpoint
 *  - testWebhook: fire a synthetic ping event to validate the endpoint
 *
 * Note: actual delivery on events is handled by WebhookNotificationService.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { isPrivateUrl } from '@/lib/security/ssrf';
import { ApiError } from '@/lib/errors';

export interface WebhookInput {
    url: string;
    enabled?: boolean;
    secret?: string;
}

/**
 * WorkspaceWebhookService — Domain layer for workspace notification webhook management.
 *
 * Encapsulates:
 *   - Single webhook per workspace: get, upsert (create-or-update), delete
 *   - Note: alert-rule webhooks live in WorkspaceAlertService; this service
 *     manages the workspace-level notification webhook (one per workspace).
 */
export class WorkspaceWebhookService {

    private static readonly SAFE_SELECT = {
        id: true,
        url: true,
        enabled: true,
        lastSuccess: true,
        lastFailure: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true,
    } as const;

    static async getWebhook(workspaceId: string) {
        return prisma.notificationWebhook.findFirst({
            where: { workspaceId },
            select: WorkspaceWebhookService.SAFE_SELECT,
        });
    }

    static async upsertWebhook(workspaceId: string, data: WebhookInput) {
        // SSRF protection: reject private/internal network URLs at storage time
        if (await isPrivateUrl(data.url)) {
            throw new ApiError(400, 'Webhook URL must not target private or internal networks');
        }

        // Auto-generate a signing secret if none provided (ensures all webhooks are signed)
        const secret = data.secret || `whsec_${crypto.randomBytes(32).toString('hex')}`;

        const existing = await prisma.notificationWebhook.findFirst({ where: { workspaceId } });

        if (existing) {
            return {
                webhook: await prisma.notificationWebhook.update({
                    where: { id: existing.id },
                    data: { url: data.url, enabled: data.enabled ?? true, secret: data.secret ?? existing.secret ?? secret },
                    select: WorkspaceWebhookService.SAFE_SELECT,
                }),
                created: false,
            };
        }

        return {
            webhook: await prisma.notificationWebhook.create({
                data: { workspaceId, url: data.url, enabled: data.enabled ?? true, secret },
                select: WorkspaceWebhookService.SAFE_SELECT,
            }),
            created: true,
        };
    }

    static async deleteWebhook(workspaceId: string) {
        await prisma.notificationWebhook.deleteMany({ where: { workspaceId } });
        return { message: 'Webhook deleted successfully' };
    }
}
