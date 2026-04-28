/**
 * WEBHOOK DELIVERY ENGINE
 * 
 * Delivers real HTTP POST webhook payloads to configured workspace endpoints.
 * Features HMAC-SHA256 signature verification, configurable retry logic,
 * structured event payloads, and comprehensive audit logging.
 */

import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { logError } from '@/lib/logger';
import { isPrivateUrl } from '@/lib/security/ssrf';

// ─── Types ───────────────────────────────────────────────

export interface WebhookEvent {
    id: string;
    type: string;
    workspaceId: string;
    timestamp: string;
    data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
    success: boolean;
    statusCode: number | null;
    duration: number;
    error?: string;
    retries: number;
}

// ─── Constants ───────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // Exponential backoff (ms)
const DELIVERY_TIMEOUT = 10000; // 10 second request timeout

// ─── HMAC Signature ──────────────────────────────────────

/**
 * Generates an HMAC-SHA256 signature for webhook payload verification.
 * The receiving endpoint can verify this by computing the same HMAC
 * with their shared secret and comparing against the X-Glanus-Signature header.
 */
function generateSignature(payload: string, secret: string): string {
    return crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
}

// ─── Core Delivery Function ─────────────────────────────

/**
 * Delivers a webhook event to the configured endpoint for a workspace.
 * Performs real HTTP POST requests with HMAC signing and automatic retries.
 * 
 * Returns null if no webhook is configured for the workspace.
 */
export async function deliverWebhook(
    workspaceId: string,
    eventType: string,
    eventData: Record<string, unknown>,
): Promise<WebhookDeliveryResult | null> {
    // 1. Fetch the webhook configuration for this workspace
    const webhook = await prisma.notificationWebhook.findFirst({
        where: { workspaceId, enabled: true },
    });

    if (!webhook) {
        return null; // No active webhook configured
    }

    // SSRF protection: block requests to private/internal networks
    if (await isPrivateUrl(webhook.url)) {
        logError(`[Webhook] Blocked delivery to private URL for workspace ${workspaceId}`);
        return { success: false, statusCode: null, duration: 0, error: 'Webhook URL must not target private or internal networks', retries: 0 };
    }

    // 2. Build the event payload
    const event: WebhookEvent = {
        id: crypto.randomUUID(),
        type: eventType,
        workspaceId,
        timestamp: new Date().toISOString(),
        data: eventData,
    };

    const payloadString = JSON.stringify(event);

    // 3. Generate HMAC signature — always sign if a secret exists;
    //    log a warning if webhook has no secret (should be set during creation)
    if (!webhook.secret) {
        logError(`[Webhook] Webhook ${webhook.id} for workspace ${workspaceId} has no signing secret configured — delivery will be unsigned`);
    }
    const signature = webhook.secret
        ? generateSignature(payloadString, webhook.secret)
        : null;

    // 4. Attempt delivery with retries
    let lastError: string | null = null;
    let lastStatusCode: number | null = null;
    let totalRetries = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'Glanus-Webhook/1.0',
                'X-Glanus-Event': eventType,
                'X-Glanus-Delivery': event.id,
                'X-Glanus-Timestamp': event.timestamp,
            };

            if (signature) {
                headers['X-Glanus-Signature'] = `sha256=${signature}`;
            }

            const response = await fetch(webhook.url, {
                method: 'POST',
                headers,
                body: payloadString,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;

            if (response.ok) {
                // Successful delivery — log it
                await logDelivery(workspaceId, event, webhook.id, {
                    success: true,
                    statusCode: response.status,
                    duration,
                    retries: totalRetries,
                });

                return {
                    success: true,
                    statusCode: response.status,
                    duration,
                    retries: totalRetries,
                };
            }

            // Non-2xx response — retry if retryable
            lastStatusCode = response.status;
            lastError = `HTTP ${response.status}: ${response.statusText}`;

            // Don't retry on 4xx client errors (except 429 Too Many Requests)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                break;
            }

        } catch (err: unknown) {
            lastError = err instanceof Error ? err.message : 'Unknown fetch error';

            // AbortError means timeout
            if (err instanceof Error && err.name === 'AbortError') {
                lastError = `Request timed out after ${DELIVERY_TIMEOUT}ms`;
            }
        }

        totalRetries++;

        // Wait before retrying (exponential backoff)
        if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        }
    }

    // All attempts exhausted — log failure
    const result: WebhookDeliveryResult = {
        success: false,
        statusCode: lastStatusCode,
        duration: 0,
        error: lastError || 'Delivery failed after maximum retries',
        retries: totalRetries,
    };

    await logDelivery(workspaceId, event, webhook.id, result);

    return result;
}

// ─── Batch Delivery ──────────────────────────────────────

/**
 * Fire webhooks to ALL configured workspace endpoints for a given event.
 * This is the primary entry point called from alert triggers and Reflex actions.
 * 
 * Runs asynchronously and does not block the calling function.
 */
export function fireWebhookAsync(
    workspaceId: string,
    eventType: string,
    eventData: Record<string, unknown>,
): void {
    // Fire-and-forget — don't await, don't block the request
    deliverWebhook(workspaceId, eventType, eventData).catch((err) => {
        logError(`[Webhook] Delivery error for workspace ${workspaceId}`, err);
    });
}

// ─── Event Builders ──────────────────────────────────────

/**
 * Pre-built event types for consistent webhook payload structures.
 */
export const WebhookEvents = {
    alertTriggered: (alertRule: { id: string; name: string; metric: string; threshold: number }, agentData: { hostname: string; currentValue: number }) => ({
        eventType: 'alert.triggered',
        data: {
            alertRuleId: alertRule.id,
            alertRuleName: alertRule.name,
            metric: alertRule.metric,
            threshold: alertRule.threshold,
            hostname: agentData.hostname,
            currentValue: agentData.currentValue,
        } as Record<string, unknown>,
    }),

    reflexActionExecuted: (ruleName: string, actionType: string, status: string, details?: Record<string, unknown>) => ({
        eventType: 'reflex.action_executed',
        data: {
            ruleName,
            actionType,
            executionStatus: status,
            ...details,
        } as Record<string, unknown>,
    }),

    scriptDeployed: (scriptName: string, targetCount: number, agentIds: string[]) => ({
        eventType: 'script.deployed',
        data: {
            scriptName,
            targetCount,
            agentIds,
        } as Record<string, unknown>,
    }),

    agentStatusChanged: (agentId: string, hostname: string, previousStatus: string, newStatus: string) => ({
        eventType: 'agent.status_changed',
        data: {
            agentId,
            hostname,
            previousStatus,
            newStatus,
        } as Record<string, unknown>,
    }),

    scheduleDelivered: (scheduleName: string, reportType: string, recipientCount: number) => ({
        eventType: 'report.schedule_delivered',
        data: {
            scheduleName,
            reportType,
            recipientCount,
        } as Record<string, unknown>,
    }),
};

// ─── Audit Trail ─────────────────────────────────────────

async function logDelivery(
    workspaceId: string,
    event: WebhookEvent,
    webhookId: string,
    result: WebhookDeliveryResult,
): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                workspaceId,
                action: `webhook.delivery.${result.success ? 'success' : 'failed'}`,
                resourceType: 'webhook',
                resourceId: webhookId,
                details: {
                    eventId: event.id,
                    eventType: event.type,
                    statusCode: result.statusCode,
                    duration: result.duration,
                    retries: result.retries,
                    error: result.error || null,
                },
            },
        });
    } catch {
        // Silent — never let audit logging break the main flow
    }
}
