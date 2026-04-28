/**
 * WebhookNotificationService — Delivers webhook payloads with exponential-backoff retry logic.
 *
 * Responsibilities:
 *  - sendWebhook: POST a signed webhook payload to a subscriber URL
 *  - retryFailedWebhooks: cron-invoked — retry pending/failed deliveries with backoff
 *  - Supports HMAC-SHA256 request signing for endpoint verification
 */
import crypto from 'crypto';
import { isPrivateUrl } from '@/lib/security/ssrf';

interface WebhookPayload {
    alert: string;
    asset: string;
    assetId: string;
    metric: string;
    value: number;
    threshold: number;
    severity: string;
    timestamp: string;
    workspaceId: string;
}

export class WebhookService {
    private maxRetries = 3;
    private retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s

    /**
     * Send webhook notification with retry logic
     */
    async send(
        url: string,
        payload: WebhookPayload,
        secret?: string
    ): Promise<{ success: boolean; error?: string }> {
        let lastError: string | undefined;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                await this.sendAttempt(url, payload, secret);
                return { success: true };
            } catch (error: unknown) {
                lastError = error instanceof Error ? error.message : 'Unknown error';

                // Don't delay after the final attempt
                if (attempt < this.maxRetries - 1) {
                    await this.delay(this.retryDelays[attempt]);
                }
            }
        }

        return {
            success: false,
            error: lastError || 'Failed after maximum retries',
        };
    }

    /**
     * Single webhook delivery attempt
     */
    private async sendAttempt(
        url: string,
        payload: WebhookPayload,
        secret?: string
    ): Promise<void> {
        if (await isPrivateUrl(url)) {
            throw new Error('Webhook URL must not target private or internal networks');
        }

        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'Glanus-Alert-Service/1.0',
        };

        // Add HMAC signature if secret provided
        if (secret) {
            const signature = crypto
                .createHmac('sha256', secret)
                .update(body)
                .digest('hex');
            headers['X-Glanus-Signature'] = signature;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    }

    /**
     * Delay helper for retries
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Update webhook stats in database
     */
    async updateWebhookStats(
        webhookId: string,
        success: boolean
    ): Promise<void> {
        const { prisma } = await import('@/lib/db');

        if (success) {
            await prisma.notificationWebhook.update({
                where: { id: webhookId },
                data: {
                    lastSuccess: new Date(),
                    failureCount: 0,
                },
            });
        } else {
            await prisma.notificationWebhook.update({
                where: { id: webhookId },
                data: {
                    lastFailure: new Date(),
                    failureCount: {
                        increment: 1,
                    },
                },
            });
        }
    }
}

export const webhookService = new WebhookService();
