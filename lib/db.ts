import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from '@/lib/prisma-extensions/soft-delete';
    import { rlsExtension } from '@/lib/prisma-extensions/rls';

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
    // Add connection pool config to the URL to prevent exhaustion under load.
    // connection_limit: max concurrent connections per Prisma Client instance.
    // pool_timeout: seconds to wait for a free connection before throwing.
    const baseUrl = process.env.DATABASE_URL || '';
    const separator = baseUrl.includes('?') ? '&' : '?';
    const poolSize = process.env.DATABASE_POOL_SIZE || '30';
    const datasourceUrl = baseUrl.includes('connection_limit')
        ? baseUrl
        : `${baseUrl}${separator}connection_limit=${poolSize}&pool_timeout=15&statement_timeout=30000`;

    return new PrismaClient({
        datasourceUrl,
        // Opt-in query logging: set PRISMA_LOG_QUERIES=1 to see every SQL query.
        // Default dev logs stay terse (error + warn) so the terminal is usable.
        log: process.env.PRISMA_LOG_QUERIES === '1'
            ? ['query', 'error', 'warn']
            : process.env.NODE_ENV === 'development'
                ? ['error', 'warn']
                : ['error'],
    }).$extends(softDeleteExtension).$extends(rlsExtension);
}

export const prisma =
    globalForPrisma.prisma ??
    createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

