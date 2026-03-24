/**
 * Prisma Soft-Delete Extension
 *
 * Automatically filters out soft-deleted records (where deletedAt is not null)
 * from findMany, findFirst, and count queries unless explicitly overridden.
 *
 * Covers: Asset, Workspace
 */

import { Prisma } from '@prisma/client';

/**
 * Prisma extension that adds soft-delete filtering to Asset and Workspace queries.
 *
 * Usage: Apply to the Prisma client in lib/db.ts:
 *   const prisma = new PrismaClient().$extends(softDeleteExtension);
 *
 * To include soft-deleted records, pass `deletedAt: { not: null }` in your where clause
 * or use `prisma.asset.findMany({ where: { deletedAt: undefined } })`.
 */
export const softDeleteExtension = Prisma.defineExtension({
    name: 'soft-delete',
    query: {
        asset: {
            async findMany({ args, query }) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const where = args.where as any;
                if (!where?.deletedAt) {
                    args.where = { ...args.where, deletedAt: null } as typeof args.where;
                }
                return query(args);
            },
            async findFirst({ args, query }) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const where = args.where as any;
                if (!where?.deletedAt) {
                    args.where = { ...args.where, deletedAt: null } as typeof args.where;
                }
                return query(args);
            },
            async count({ args, query }) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const where = args.where as any;
                if (!where?.deletedAt) {
                    args.where = { ...args.where, deletedAt: null } as typeof args.where;
                }
                return query(args);
            },
        },
        workspace: {
            async findMany({ args, query }) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const where = args.where as any;
                if (!where?.deletedAt) {
                    args.where = { ...args.where, deletedAt: null } as typeof args.where;
                }
                return query(args);
            },
            async findFirst({ args, query }) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const where = args.where as any;
                if (!where?.deletedAt) {
                    args.where = { ...args.where, deletedAt: null } as typeof args.where;
                }
                return query(args);
            },
            async count({ args, query }) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const where = args.where as any;
                if (!where?.deletedAt) {
                    args.where = { ...args.where, deletedAt: null } as typeof args.where;
                }
                return query(args);
            },
        },
    },
});
