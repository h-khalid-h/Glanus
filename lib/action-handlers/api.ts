import type { ActionDefinition, ActionAsset, ActionResult, ApiHandlerConfig } from './types';

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

        const data = await response.json();

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
