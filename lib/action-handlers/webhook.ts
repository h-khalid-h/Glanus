import type { ActionDefinition, ActionAsset, ActionResult, WebhookHandlerConfig } from './types';
import { isPrivateUrl } from '@/lib/security/ssrf';

/**
 * Webhook Handler - Sends POST to configured webhook URL with HMAC signature
 */
export async function handleWebhookAction(
    actionDefinition: ActionDefinition,
    asset: ActionAsset,
    parameters: Record<string, unknown>
): Promise<ActionResult> {
    const config = (actionDefinition.handlerConfig || {}) as WebhookHandlerConfig;
    const { webhookUrl, secret } = config;

    if (!webhookUrl) {
        return { status: 'FAILED', error: 'Webhook handler missing webhookUrl configuration' };
    }

    // SSRF protection: block requests to private/internal networks
    if (isPrivateUrl(webhookUrl)) {
        return { status: 'FAILED', error: 'Webhook URL must not target private or internal networks' };
    }

    try {
        const payload = {
            event: 'action.executed',
            action: actionDefinition.name,
            asset: {
                id: asset.id,
                name: asset.name,
            },
            parameters,
            timestamp: new Date().toISOString(),
        };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (secret) {
            // Add HMAC signature for webhook verification
            const crypto = await import('crypto');
            const signature = crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(payload))
                .digest('hex');
            headers['X-Webhook-Signature'] = signature;
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        const data = await response.text();

        if (!response.ok) {
            return {
                status: 'FAILED',
                error: `Webhook failed: ${response.status}`,
                output: data,
            };
        }

        return {
            status: 'COMPLETED',
            output: { webhookResponse: data },
        };
    } catch (error: unknown) {
        return {
            status: 'FAILED',
            error: `Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}
