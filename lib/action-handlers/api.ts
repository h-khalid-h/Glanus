import type { ActionDefinition, ActionAsset, ActionResult, ApiHandlerConfig } from './types';
import { isPrivateUrl } from '@/lib/security/ssrf';

/**
 * API Handler - Makes HTTP request to external API
 */
export async function handleApiAction(
    actionDefinition: ActionDefinition,
    asset: ActionAsset,
    parameters: Record<string, unknown>
): Promise<ActionResult> {
    const config = (actionDefinition.handlerConfig || {}) as ApiHandlerConfig;
    const { url, method = 'POST', headers = {} } = config;

    if (!url) {
        return { status: 'FAILED', error: 'API handler missing URL configuration' };
    }

    // SSRF protection: block requests to private/internal networks
    if (await isPrivateUrl(url)) {
        return { status: 'FAILED', error: 'API handler URL must not target private or internal networks' };
    }

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            body: JSON.stringify({
                action: actionDefinition.name,
                asset: {
                    id: asset.id,
                    name: asset.name,
                },
                parameters,
            }),
        });

        // Safely parse response body (may not be JSON)
        let data: unknown;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch {
                data = await response.text();
            }
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            return {
                status: 'FAILED',
                error: `API request failed: ${response.status}`,
                output: data,
            };
        }

        return {
            status: 'COMPLETED',
            output: data,
        };
    } catch (error: unknown) {
        return {
            status: 'FAILED',
            error: `API request error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}
