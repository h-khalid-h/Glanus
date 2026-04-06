/**
 * Standardized API Response Helpers
 * 
 * Ensures consistent response format across all API routes:
 * { success: true, data: T, meta?: { ... } }
 * { success: false, error: { code, message, details? } }
 */

import { NextResponse } from 'next/server';

/**
 * Return a successful JSON response with standardized format.
 */
export function apiSuccess<T>(
    data: T,
    meta?: Record<string, unknown>,
    status = 200,
    headers?: Record<string, string>
) {
    return NextResponse.json(
        {
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                ...meta,
            },
        },
        { status, headers }
    );
}

/**
 * Return an error JSON response with standardized format.
 */
export function apiError(
    code: number,
    message: string,
    details?: unknown
) {
    return NextResponse.json(
        {
            success: false,
            error: {
                code,
                message,
                ...(details ? { details } : {}),
            },
        },
        { status: code }
    );
}

/**
 * Return a 201 Created response.
 */
export function apiCreated<T>(data: T, meta?: Record<string, unknown>) {
    return apiSuccess(data, meta, 201);
}

/**
 * Return a 204 No Content response (for DELETE operations).
 */
export function apiDeleted() {
    return new NextResponse(null, { status: 204 });
}

/**
 * Return a paginated response with cursor/offset metadata.
 */
export function apiPaginated<T>(
    data: T[],
    pagination: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }
) {
    return apiSuccess(data, { pagination });
}

/**
 * Parse pagination params from URL search params.
 */
export function parsePagination(url: string): { page: number; pageSize: number; skip: number } {
    const searchParams = new URL(url).searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

    return {
        page,
        pageSize,
        skip: (page - 1) * pageSize,
    };
}
