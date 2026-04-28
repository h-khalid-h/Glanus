import dns from 'dns';

/**
 * SSRF (Server-Side Request Forgery) protection utilities.
 *
 * Validates that outbound URLs do not target private, internal, or metadata endpoints.
 */

/**
 * Returns true if the URL targets a private/internal network or cloud metadata endpoint.
 */
export async function isPrivateUrl(urlString: string): Promise<boolean> {
    try {
        const parsed = new URL(urlString);
        const hostname = parsed.hostname;

        // Block localhost and loopback string matches immediately
        if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') {
            return true;
        }

        // Block common metadata endpoints
        if (hostname === 'metadata.google.internal' || hostname === 'metadata.google') {
            return true;
        }

        // Resolve the hostname to an IP address to prevent DNS rebinding / obfuscated IPs
        const bareHostname = hostname.replace(/^\[|\]$/g, '');
        const lookups = await dns.promises.lookup(bareHostname, { all: true });

        for (const lookup of lookups) {
            const { address, family } = lookup;
            if (family === 4) {
                const ipv4Match = address.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
                if (ipv4Match) {
                    const [, a, b] = ipv4Match.map(Number);
                    if (a === 127) return true;                          // 127.0.0.0/8 (loopback)
                    if (a === 10) return true;                           // 10.0.0.0/8
                    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
                    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
                    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local / cloud metadata)
                    if (a === 0) return true;                            // 0.0.0.0/8
                }
            } else if (family === 6) {
                if (isPrivateIPv6(address)) {
                    return true;
                }
            }
        }

        return false;
    } catch {
        return true; // Invalid URL or DNS resolution failed — block
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
