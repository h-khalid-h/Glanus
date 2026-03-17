/**
 * Shared error primitives for service and route layers.
 *
 * Import `ApiError` in both services and routes to throw structured HTTP errors
 * that `withErrorHandler` (lib/api/withAuth.ts) intercepts and normalizes into
 * consistent JSON responses.
 *
 * Usage:
 *   throw new ApiError(404, 'Asset not found');
 *   throw new ApiError(403, 'Insufficient permissions');
 */

export class ApiError extends Error {
    public statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}
