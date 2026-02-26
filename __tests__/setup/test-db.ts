import { PrismaClient } from '@prisma/client';

/**
 * Test Database Setup
 * Provides database connection management for tests
 */

// Create a singleton PrismaClient for tests
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const testDb = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'postgresql://localhost:5432/glanus_test',
        },
    },
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = testDb;
}

/**
 * Setup database connection before all tests
 * Also seeds the mock auth user to match jest.setup.js mock session
 */
export async function setupTestDatabase() {
    await testDb.$connect();
    await seedTestAuthUser();
}

/**
 * Create the user that matches the mocked getServerSession in jest.setup.js
 * (email: test@example.com, role: ADMIN)
 */
async function seedTestAuthUser() {
    await testDb.user.upsert({
        where: { email: 'test@example.com' },
        update: {},
        create: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            role: 'ADMIN',
            password: '$2a$10$dummyhashedpasswordfortest',
        },
    });
}

/**
 * Close database connection after all tests
 */
export async function teardownTestDatabase() {
    await testDb.$disconnect();
}

/**
 * Begin a transaction for test isolation
 * Tests should use this to ensure data is rolled back after each test
 */
export async function withTransaction<T>(
    fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
    return await testDb.$transaction(async (tx) => {
        try {
            return await fn(tx as PrismaClient);
        } catch (error: unknown) {
            // Transaction will automatically rollback on error
            throw error;
        }
    });
}

/**
 * Reset database to clean state
 * Use sparingly as this is expensive
 */
export async function resetDatabase() {
    // Delete all data in reverse order of dependencies
    const tables = [
        'AssetFieldValue',
        'AssetActionExecution',
        'AssetRelationship',
        'PhysicalAsset',
        'DigitalAsset',
        'Asset',
        'AssetFieldDefinition',
        'AssetActionDefinition',
        'AssetCategory',
        'User',
    ];

    for (const table of tables) {
        await testDb.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
}
