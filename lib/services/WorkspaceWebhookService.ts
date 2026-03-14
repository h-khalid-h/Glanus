import { prisma } from '@/lib/db';

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

    static async getWebhook(workspaceId: string) {
        return prisma.notificationWebhook.findFirst({ where: { workspaceId } });
    }

    static async upsertWebhook(workspaceId: string, data: WebhookInput) {
        const existing = await prisma.notificationWebhook.findFirst({ where: { workspaceId } });

        if (existing) {
            return {
                webhook: await prisma.notificationWebhook.update({
                    where: { id: existing.id },
                    data: { url: data.url, enabled: data.enabled ?? true, secret: data.secret },
                }),
                created: false,
            };
        }

        return {
            webhook: await prisma.notificationWebhook.create({
                data: { workspaceId, url: data.url, enabled: data.enabled ?? true, secret: data.secret },
            }),
            created: true,
        };
    }

    static async deleteWebhook(workspaceId: string) {
        await prisma.notificationWebhook.deleteMany({ where: { workspaceId } });
        return { message: 'Webhook deleted successfully' };
    }
}
