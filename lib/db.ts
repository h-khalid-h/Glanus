import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from '@/lib/prisma-extensions/soft-delete';

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
    // Add connection pool config to the URL to prevent exhaustion under load.
    // connection_limit: max concurrent connections per Prisma Client instance.
    // pool_timeout: seconds to wait for a free connection before throwing.
    const baseUrl = process.env.DATABASE_URL || '';
    const separator = baseUrl.includes('?') ? '&' : '?';
    const datasourceUrl = baseUrl.includes('connection_limit')
        ? baseUrl
        : `${baseUrl}${separator}connection_limit=10&pool_timeout=20&statement_timeout=30000`;

    return new PrismaClient({
        datasourceUrl,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    }).$extends(softDeleteExtension);
}

export const prisma =
    globalForPrisma.prisma ??
    createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

