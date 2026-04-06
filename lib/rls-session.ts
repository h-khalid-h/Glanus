/**
 * RLS Session Helper
 *
 * Wraps a Prisma interactive transaction so that PostgreSQL-level RLS
 * policies can read the current tenant via `current_setting(...)`.
 *
 * SET LOCAL is transaction-scoped, so the values are automatically
 * cleared when the transaction ends — safe for connection pooling.
 *
 * Usage (in a route / service):
 *
 *   import { withRLSSession } from '@/lib/rls-session';
 *   import { prisma } from '@/lib/db';
 *   import { getRLSContext } from '@/lib/rls-context';
 *
 *   const ctx = getRLSContext();
 *   const result = await withRLSSession(ctx, async (tx) => {
 *     return tx.asset.findMany();
 *   });
 *
 * The `tx` client already has the RLS Prisma extension applied because it
 * is derived from the base `prisma` instance.
 */

import { prisma } from '@/lib/db';
import type { RLSContext } from '@/lib/rls-context';

// Derive the transaction client type from the extended prisma instance so
// that the extensions (soft-delete, rls) are reflected in the tx type.
type ExtendedPrismaTx = Parameters<Parameters<(typeof prisma)['$transaction']>[0]>[0];

/**
 * Run `fn` inside a Prisma interactive transaction with PostgreSQL session
 * variables set for RLS policies.
 *
 * @param ctx   - The RLS context (workspaceId, userId, isAdmin).
 *               Pass null to run without tenant restrictions (system jobs).
 * @param fn    - Callback that receives the transactional Prisma client.
 */
export async function withRLSSession<T>(
    ctx: RLSContext | null,
    fn: (tx: ExtendedPrismaTx) => Promise<T>
): Promise<T> {
    return prisma.$transaction(async (tx) => {
        if (ctx) {
            await tx.$executeRaw`
                SELECT
                    set_config('app.current_workspace_id', ${ctx.workspaceId ?? ''}, true),
                    set_config('app.current_user_id',      ${ctx.userId},             true),
                    set_config('app.is_admin',             ${ctx.isAdmin ? 'true' : 'false'}, true)
            `;
        }
        return fn(tx);
    });
}

/**
 * Convenience wrapper that reads the RLS context from AsyncLocalStorage
 * automatically.  Prefer this in service code that already runs inside
 * `withRLSContext()`.
 */
export async function withCurrentRLSSession<T>(
    fn: (tx: ExtendedPrismaTx) => Promise<T>
): Promise<T> {
    // Lazy import to avoid circular dependency at module load time
    const { getRLSContext } = await import('@/lib/rls-context');
    const ctx = getRLSContext();
    return withRLSSession(ctx, fn);
}
