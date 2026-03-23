/**
 * SSRF (Server-Side Request Forgery) protection utilities.
 *
 * Validates that outbound URLs do not target private, internal, or metadata endpoints.
 */

/**
 * Returns true if the URL targets a private/internal network or cloud metadata endpoint.
 */
export function isPrivateUrl(urlString: string): boolean {
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
