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
        if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') {
            return true;
        }

        // Block private IPv4 ranges
        const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (ipv4Match) {
            const [, a, b] = ipv4Match.map(Number);
            if (a === 127) return true;                          // 127.0.0.0/8 (loopback)
            if (a === 10) return true;                           // 10.0.0.0/8
            if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
            if (a === 192 && b === 168) return true;             // 192.168.0.0/16
            if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local / cloud metadata)
            if (a === 0) return true;                            // 0.0.0.0/8
        }

        // Block private/reserved IPv6 ranges (strip brackets for bracketed IPv6)
        const bare = hostname.replace(/^\[|\]$/g, '');
        if (isPrivateIPv6(bare)) {
            return true;
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
 * Check if an IPv6 address is in a private/reserved range.
 */
function isPrivateIPv6(addr: string): boolean {
    const lower = addr.toLowerCase();
    if (lower === '::1') return true;                    // Loopback
    if (lower.startsWith('fe80')) return true;           // Link-local (fe80::/10)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA (fc00::/7)
    if (lower.startsWith('ff')) return true;             // Multicast (ff00::/8)
    if (lower === '::') return true;                     // Unspecified address
    // IPv4-mapped IPv6 (::ffff:x.x.x.x) — delegate to IPv4 check
    const v4mapped = lower.match(/^::ffff:(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (v4mapped) {
        const [, a, b] = v4mapped.map(Number);
        if (a === 127 || a === 10 || a === 0) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 169 && b === 254) return true;
    }
    return false;
}
