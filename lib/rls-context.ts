/**
 * RLS Context
 *
 * Carries per-request tenancy information via AsyncLocalStorage so that
 * the Prisma RLS extension and the PostgreSQL session variable helper can
 * read the current workspace/user without explicit prop-drilling.
 *
 * Usage:
 *   withRLSContext({ workspaceId, userId, isAdmin }, async () => {
 *     // all prisma calls inside here see the RLS context
 *   });
 *
 *   const ctx = getRLSContext(); // returns null when called outside a context
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface RLSContext {
    workspaceId: string | null;
    userId: string;
    isAdmin: boolean;
}

const rlsStorage = new AsyncLocalStorage<RLSContext>();

/**
 * Run `fn` inside an RLS context.  Nested calls replace the outer context
 * for the duration of the inner call only.
 */
export function withRLSContext<T>(ctx: RLSContext, fn: () => Promise<T>): Promise<T> {
    return rlsStorage.run(ctx, fn);
}

/**
 * Returns the current RLS context, or null when called outside one.
 * Callers that require a context should throw if null is returned.
 */
export function getRLSContext(): RLSContext | null {
    return rlsStorage.getStore() ?? null;
}

/**
 * Like getRLSContext() but throws if called outside a context.
 * Use in code that must always run within a tenant request.
 */
export function requireRLSContext(): RLSContext {
    const ctx = getRLSContext();
    if (!ctx) {
        throw new Error('RLS context is not set. Ensure withRLSContext() wraps this call.');
    }
    return ctx;
}
