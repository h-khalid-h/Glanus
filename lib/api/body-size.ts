/**
 * Request Body Size Limiter
 * 
 * Enforces maximum request body sizes on API routes to prevent
 * denial-of-service via oversized payloads.
 */

import { apiError } from '@/lib/api/response';

// Default limits (in bytes)
export const BODY_SIZE_LIMITS = {
    /** Standard JSON API payloads (1 MB) */
    json: 1 * 1024 * 1024,
    /** File uploads (50 MB) */
    upload: 50 * 1024 * 1024,
    /** Webhook payloads (256 KB) */
    webhook: 256 * 1024,
} as const;

type SizePreset = keyof typeof BODY_SIZE_LIMITS;

/**
 * Check if the request body exceeds the given size limit.
 * Returns an error response if exceeded, or null if within bounds.
 *
 * @example
 * const sizeError = enforceBodySize(request, 'json');
 * if (sizeError) return sizeError;
 */
export function enforceBodySize(
    request: { headers: { get(name: string): string | null } },
    preset: SizePreset | number = 'json',
) {
    const limit = typeof preset === 'number' ? preset : BODY_SIZE_LIMITS[preset];
    const contentLength = request.headers.get('content-length');

    if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (!isNaN(size) && size > limit) {
            const limitMB = (limit / (1024 * 1024)).toFixed(1);
            return apiError(
                413,
                `Request body too large. Maximum size is ${limitMB} MB.`
            );
        }
    } else if (request.headers.get('transfer-encoding')) {
        // Chunked requests without Content-Length: reject if no length declared
        // to prevent unbounded streaming payloads
        const limitMB = (limit / (1024 * 1024)).toFixed(1);
        return apiError(
            411,
            `Content-Length header is required. Maximum size is ${limitMB} MB.`
        );
    }

    return null;
}
