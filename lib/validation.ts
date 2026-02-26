import { z } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Validate request body against Zod schema
 * Returns validated data or throws formatted error
 */
export async function validateRequest<T>(
    request: Request,
    schema: z.ZodType<T>
): Promise<T> {
    try {
        const body = await request.json();
        return schema.parse(body);
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            throw new ValidationError(error.errors);
        }
        throw error;
    }
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQuery<T>(
    searchParams: URLSearchParams,
    schema: z.ZodType<T>
): T {
    const params = Object.fromEntries(searchParams.entries());
    try {
        return schema.parse(params);
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            throw new ValidationError(error.errors);
        }
        throw error;
    }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
    constructor(public errors: z.ZodIssue[]) {
        super('Validation failed');
        this.name = 'ValidationError';
    }

    toJSON() {
        return {
            error: 'Validation failed',
            details: this.errors.map(err => ({
                path: err.path.join('.'),
                message: err.message,
                code: err.code,
            })),
        };
    }
}

/**
 * Handle validation errors in API routes
 */
export function handleValidationError(error: unknown): NextResponse {
    if (error instanceof ValidationError) {
        return NextResponse.json(error.toJSON(), { status: 400 });
    }
    throw error; // Re-throw for global error handler
}
