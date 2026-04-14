/**
 * Raw Prisma client for auth operations.
 *
 * Auth tables (RefreshToken, AuthSession, EmailVerification) are NOT
 * workspace-scoped, so they don't need the RLS or soft-delete extensions.
 * Using the base PrismaClient avoids type-resolution issues with $extends()
 * and is marginally faster for auth-path operations.
 */

import { PrismaClient } from '@prisma/client';

const globalForAuthPrisma = globalThis as unknown as {
    authPrisma: PrismaClient | undefined;
};

export const authPrisma =
    globalForAuthPrisma.authPrisma ??
    new PrismaClient({
        datasourceUrl: process.env.DATABASE_URL,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForAuthPrisma.authPrisma = authPrisma;
