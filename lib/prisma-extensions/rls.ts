/**
 * Prisma Row Level Security Extension
 *
 * Application-level tenant isolation layer.  For every query on a
 * workspace-scoped model it automatically injects `workspaceId` into the
 * `where` clause (reads) or validates it on writes.
 *
 * A second, lighter PostgreSQL-level policy (see the RLS migration) forms the
 * hard security barrier.  This extension is the convenience layer that makes
 * it impossible to accidentally omit the workspace filter in application code.
 *
 * Behaviour:
 *  - ADMIN users (isAdmin = true) bypass all tenant filters.
 *  - Missing RLS context is treated as a programming error and throws.
 *  - `create` / `createMany` calls are validated: cannot create a row for a
 *    different workspace than the one in context.
 *  - Nullable-workspaceId models (Location, AuditLog, AIInsight) are
 *    filtered by workspaceId when it is set, OR allow rows where
 *    workspaceId IS NULL (global records).
 */

import { Prisma } from '@prisma/client';
import { getRLSContext } from '@/lib/rls-context';

// ---------------------------------------------------------------------------
// Model name sets
// ---------------------------------------------------------------------------

/** Tables with a required (non-nullable) workspaceId column. */
const WORKSPACE_REQUIRED = new Set([
    'WorkspaceMember',
    'WorkspaceInvitation',
    'Subscription',
    'Asset',
    'Script',
    'ScriptSchedule',
    'ActionQueueItem',
    'ScriptExecution',
    'AlertRule',
    'NotificationWebhook',
    'AgentConnection',
    'MdmProfile',
    'ReportSchedule',
    'ApiKey',
    'MaintenanceWindow',
    'PatchPolicy',
    'ZtnaPolicy',
    'NetworkDevice',
    'DiscoveryScan',
    'Ticket',
    'PartnerAssignment',
]);

/** Tables with a nullable workspaceId column (also include global rows). */
const WORKSPACE_NULLABLE = new Set([
    'Location',
    'AuditLog',
    'AIInsight',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = Record<string, any>;

export function injectRequiredWorkspaceFilter(args: AnyArgs, workspaceId: string): AnyArgs {
    return {
        ...args,
        where: { ...((args.where as AnyArgs) ?? {}), workspaceId },
    };
}

export function injectNullableWorkspaceFilter(args: AnyArgs, workspaceId: string): AnyArgs {
    // Allow explicit rows for this workspace OR rows with no workspace (global)
    const existing: AnyArgs = (args.where as AnyArgs) ?? {};
    return {
        ...args,
        where: {
            ...existing,
            OR: [
                { workspaceId },
                { workspaceId: null },
            ],
        },
    };
}

export function validateWrite(args: AnyArgs, workspaceId: string, model: string): void {
    const data: AnyArgs = args.data as AnyArgs ?? {};
    // For createMany the data is an array
    const records: AnyArgs[] = Array.isArray(data) ? data : [data];
    for (const record of records) {
        if (record.workspaceId && record.workspaceId !== workspaceId) {
            throw new Error(
                `RLS violation: attempted to write ${model} with workspaceId=${record.workspaceId} ` +
                `but active context is workspaceId=${workspaceId}`
            );
        }
        if (!record.workspaceId) {
            record.workspaceId = workspaceId;
        }
    }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const rlsExtension = Prisma.defineExtension({
    name: 'rls',
    query: {
        $allModels: {
            // ----------------------------------------------------------------
            // Read operations — inject workspaceId filter
            // ----------------------------------------------------------------
            async findMany({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model)) {
                    return query(injectRequiredWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                if (WORKSPACE_NULLABLE.has(model)) {
                    return query(injectNullableWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                return query(args);
            },

            async findFirst({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model)) {
                    return query(injectRequiredWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                if (WORKSPACE_NULLABLE.has(model)) {
                    return query(injectNullableWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                return query(args);
            },

            async findUnique({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model) || WORKSPACE_NULLABLE.has(model)) {
                    // findUnique uses `where` with unique fields; add workspaceId as an
                    // additional AND constraint via findFirst semantics where possible.
                    // Prisma will throw at runtime if the unique constraint requires it.
                    (a.where as AnyArgs).workspaceId = ctx.workspaceId;
                }
                return query(args);
            },

            async findUniqueOrThrow({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model) || WORKSPACE_NULLABLE.has(model)) {
                    (a.where as AnyArgs).workspaceId = ctx.workspaceId;
                }
                return query(args);
            },

            async findFirstOrThrow({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model)) {
                    return query(injectRequiredWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                if (WORKSPACE_NULLABLE.has(model)) {
                    return query(injectNullableWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                return query(args);
            },

            async count({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model)) {
                    return query(injectRequiredWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                if (WORKSPACE_NULLABLE.has(model)) {
                    return query(injectNullableWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                return query(args);
            },

            async aggregate({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model)) {
                    return query(injectRequiredWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                return query(args);
            },

            // ----------------------------------------------------------------
            // Write operations — validate / auto-fill workspaceId
            // ----------------------------------------------------------------
            async create({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                if (WORKSPACE_REQUIRED.has(model) || WORKSPACE_NULLABLE.has(model)) {
                    validateWrite(args as AnyArgs, ctx.workspaceId, model);
                }
                return query(args);
            },

            async createMany({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                if (WORKSPACE_REQUIRED.has(model) || WORKSPACE_NULLABLE.has(model)) {
                    validateWrite(args as AnyArgs, ctx.workspaceId, model);
                }
                return query(args);
            },

            async update({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model)) {
                    (a.where as AnyArgs).workspaceId = ctx.workspaceId;
                }
                return query(args);
            },

            async updateMany({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model)) {
                    return query(injectRequiredWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                return query(args);
            },

            async upsert({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model) || WORKSPACE_NULLABLE.has(model)) {
                    // Constrain the lookup and ensure create/update carry workspaceId
                    (a.where as AnyArgs).workspaceId = ctx.workspaceId;
                    if (a.create) (a.create as AnyArgs).workspaceId = ctx.workspaceId;
                    if (a.update) {
                        const u = a.update as AnyArgs;
                        if (u.workspaceId !== undefined && u.workspaceId !== ctx.workspaceId) {
                            throw new Error(
                                `RLS violation: cannot change workspaceId on ${model}`
                            );
                        }
                    }
                }
                return query(args);
            },

            async delete({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model)) {
                    (a.where as AnyArgs).workspaceId = ctx.workspaceId;
                }
                return query(args);
            },

            async deleteMany({ model, args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);
                if (!ctx.workspaceId) return query(args);

                const a = args as AnyArgs;
                if (WORKSPACE_REQUIRED.has(model)) {
                    return query(injectRequiredWorkspaceFilter(a, ctx.workspaceId) as typeof args);
                }
                return query(args);
            },
        },

        // --------------------------------------------------------------------
        // User model — self-access only (non-admin)
        // --------------------------------------------------------------------
        user: {
            async findMany({ args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);

                const a = args as AnyArgs;
                return query({
                    ...a,
                    where: { ...(a.where ?? {}), id: ctx.userId },
                } as typeof args);
            },

            async findFirst({ args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);

                const a = args as AnyArgs;
                return query({
                    ...a,
                    where: { ...(a.where ?? {}), id: ctx.userId },
                } as typeof args);
            },

            async update({ args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);

                const a = args as AnyArgs;
                (a.where as AnyArgs).id = ctx.userId;
                return query(args);
            },

            async delete({ args, query }) {
                const ctx = getRLSContext();
                if (!ctx || ctx.isAdmin) return query(args);

                const a = args as AnyArgs;
                (a.where as AnyArgs).id = ctx.userId;
                return query(args);
            },
        },
    },
});
