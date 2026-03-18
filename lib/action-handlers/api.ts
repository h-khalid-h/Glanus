import type { ActionDefinition, ActionAsset, ActionResult, ApiHandlerConfig } from './types';

/**
 * Validate that a URL does not target private/internal networks (SSRF protection).
 */
function isPrivateUrl(urlString: string): boolean {
    try {
        const parsed = new URL(urlString);
        const hostname = parsed.hostname;

        // Block localhost and loopback
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
            return true;
        }

        // Block private IPv4 ranges
        const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (ipv4Match) {
            const [, a, b] = ipv4Match.map(Number);
            if (a === 10) return true;                          // 10.0.0.0/8
            if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
            if (a === 192 && b === 168) return true;             // 192.168.0.0/16
            if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local)
            if (a === 0) return true;                            // 0.0.0.0/8
        }

        // Block common metadata endpoints
        if (hostname === 'metadata.google.internal' || hostname === 'metadata.google') {
            return true;
        }

        return false;
    } catch {
        return true; // Invalid URL — block
    }
}

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
    if (isPrivateUrl(url)) {
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
