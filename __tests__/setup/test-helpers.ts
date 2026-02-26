import { prisma } from '@/lib/db';
import { hash } from 'bcryptjs';
import { NextRequest } from 'next/server';
import type {
    User,
    AssetCategory,
    AssetFieldDefinition,
    AssetActionDefinition,
    Asset,
    AssetFieldValue
} from '@prisma/client';

/**
 * Test Helpers for Dynamic Asset System Integration Tests
 * Provides utilities for creating test data, authentication, and cleanup
 */

// ============================================
// User Management
// ============================================

export async function createTestUser(overrides: Partial<User> = {}): Promise<User> {
    const hashedPassword = await hash('test-password-123', 10);

    return prisma.user.create({
        data: {
            email: overrides.email || `test-${Date.now()}@example.com`,
            name: overrides.name || 'Test User',
            password: hashedPassword,
            role: overrides.role || 'USER',
            ...overrides,
        },
    });
}

// ============================================
// Category Management
// ============================================

export async function createTestCategory(overrides: Partial<AssetCategory> = {}): Promise<AssetCategory> {
    const { id, createdAt, updatedAt, ...rest } = overrides;
    return prisma.assetCategory.create({
        data: {
            name: rest.name || `Test Category ${Date.now()}`,
            slug: rest.slug || `test-category-${Date.now()}`,
            assetTypeValue: rest.assetTypeValue || 'PHYSICAL',
            description: rest.description || 'Test category description',
            icon: rest.icon || '📦',
            isActive: rest.isActive ?? true,
            parentId: rest.parentId || null,
        },
    });
}

export async function createCategoryHierarchy(): Promise<{
    parent: AssetCategory;
    child: AssetCategory;
    grandchild: AssetCategory;
}> {
    const parent = await createTestCategory({ name: 'Parent Category' });
    const child = await createTestCategory({
        name: 'Child Category',
        parentId: parent.id
    });
    const grandchild = await createTestCategory({
        name: 'Grandchild Category',
        parentId: child.id
    });

    return { parent, child, grandchild };
}

// ============================================
// Field Definition Management
// ============================================

export async function createTestField(
    categoryId: string,
    overrides: Partial<AssetFieldDefinition> = {}
): Promise<AssetFieldDefinition> {
    return prisma.assetFieldDefinition.create({
        data: {
            categoryId,
            name: overrides.name || `Test Field ${Date.now()}`,
            slug: overrides.slug || `test-field-${Date.now()}`,
            fieldType: overrides.fieldType || 'STRING',
            label: overrides.label || 'Test Field Label',
            description: overrides.description || null,
            isRequired: overrides.isRequired ?? false,
            isInherited: overrides.isInherited ?? false,
            defaultValue: overrides.defaultValue || null,
            validationRules: (overrides.validationRules as any) || {},
            sortOrder: overrides.sortOrder ?? 0,
        },
    });
}

export async function createFieldsForAllTypes(categoryId: string): Promise<AssetFieldDefinition[]> {
    const fieldTypes = [
        'STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'TIME',
        'TEXT', 'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL', 'PHONE',
        'JSON', 'ARRAY', 'FILE', 'IMAGE', 'COLOR', 'CURRENCY',
        'PERCENTAGE', 'DURATION', 'IP_ADDRESS', 'MAC_ADDRESS',
        'UUID', 'REGEX', 'CODE'
    ];

    const fields: AssetFieldDefinition[] = [];
    for (let i = 0; i < fieldTypes.length; i++) {
        const type = fieldTypes[i];
        const field = await createTestField(categoryId, {
            name: `${type} Field`,
            slug: `${type.toLowerCase()}-field`,
            fieldType: type as any,
            sortOrder: i,
        });
        fields.push(field);
    }

    return fields;
}

// ============================================
// Action Definition Management
// ============================================

export async function createTestAction(
    categoryId: string,
    overrides: Partial<AssetActionDefinition> = {}
): Promise<AssetActionDefinition> {
    return prisma.assetActionDefinition.create({
        data: {
            categoryId,
            name: overrides.name || `Test Action ${Date.now()}`,
            slug: overrides.slug || `test-action-${Date.now()}`,
            label: overrides.label || 'Test Action',
            description: overrides.description || 'Test action description',
            actionType: (overrides.actionType || 'MANUAL') as any,
            icon: overrides.icon || '⚡',
            requiresConfirmation: overrides.requiresConfirmation ?? false,
            isDestructive: overrides.isDestructive ?? false,
            estimatedDuration: overrides.estimatedDuration || null,
            sortOrder: overrides.sortOrder ?? 0,
        } as any,
    });
}

export async function createActionsForAllHandlers(categoryId: string): Promise<AssetActionDefinition[]> {
    const handlers = ['API', 'WEBHOOK', 'MANUAL', 'SCRIPT', 'REMOTE_COMMAND'];

    const actions: AssetActionDefinition[] = [];
    for (let i = 0; i < handlers.length; i++) {
        const handler = handlers[i];
        const action = await createTestAction(categoryId, {
            name: `${handler} Action`,
            slug: `${handler.toLowerCase()}-action`,
            actionType: handler as any,
            sortOrder: i,
        });
        actions.push(action);
    }

    return actions;
}

// ============================================
// Asset Management
// ============================================

export async function createTestAsset(
    categoryId: string,
    userId: string,
    overrides: Partial<Asset> = {}
): Promise<Asset> {
    return prisma.asset.create({
        data: {
            name: overrides.name || `Test Asset ${Date.now()}`,
            assetType: overrides.assetType || 'PHYSICAL',
            categoryId,
            workspaceId: (overrides as any).workspaceId || 'test-workspace', // eslint-disable-line @typescript-eslint/no-explicit-any
            assignedToId: userId,
            status: overrides.status || 'AVAILABLE',
            location: overrides.location || null,
            purchaseDate: overrides.purchaseDate || null,
            purchaseCost: overrides.purchaseCost || null,
            warrantyUntil: overrides.warrantyUntil || null,
            description: overrides.description || null,
            tags: overrides.tags || [],
            ...overrides,
        },
    });
}

export async function createAssetWithFieldValues(
    categoryId: string,
    userId: string,
    fieldValues: Record<string, any>
): Promise<{ asset: Asset; values: AssetFieldValue[] }> {
    const asset = await createTestAsset(categoryId, userId);

    // Get field definitions for the category
    const fields = await prisma.assetFieldDefinition.findMany({
        where: { categoryId },
    });

    const values: AssetFieldValue[] = [];
    for (const field of fields) {
        if (fieldValues[field.slug] !== undefined) {
            const value = await prisma.assetFieldValue.create({
                data: {
                    assetId: asset.id,
                    fieldDefinitionId: field.id,
                    valueString: JSON.stringify(fieldValues[field.slug]),
                },
            });
            values.push(value);
        }
    }

    return { asset, values };
}

// ============================================
// Cleanup Utilities
// ============================================

export async function cleanupTestData() {
    // Delete in reverse order of dependencies
    await prisma.assetFieldValue.deleteMany({});
    await prisma.assetActionExecution.deleteMany({});
    await prisma.assetRelationship.deleteMany({});
    await prisma.physicalAsset.deleteMany({});
    await prisma.digitalAsset.deleteMany({});
    await prisma.asset.deleteMany({});
    await prisma.assetFieldDefinition.deleteMany({});
    await prisma.assetActionDefinition.deleteMany({});
    await prisma.assetCategory.deleteMany({});

    // Clean up test users (keep system users)
    await prisma.user.deleteMany({
        where: {
            email: {
                contains: 'test-',
            },
        },
    });
}

export async function cleanupCategory(categoryId: string) {
    await prisma.assetFieldDefinition.deleteMany({ where: { categoryId } });
    await prisma.assetActionDefinition.deleteMany({ where: { categoryId } });
    await prisma.assetCategory.delete({ where: { id: categoryId } });
}

export async function cleanupAsset(assetId: string) {
    await prisma.assetFieldValue.deleteMany({ where: { assetId } });
    await prisma.assetActionExecution.deleteMany({ where: { assetId } });
    await prisma.assetRelationship.deleteMany({
        where: {
            OR: [
                { parentAssetId: assetId },
                { childAssetId: assetId },
            ],
        },
    });
    await prisma.physicalAsset.deleteMany({ where: { assetId } });
    await prisma.digitalAsset.deleteMany({ where: { assetId } });
    await prisma.asset.delete({ where: { id: assetId } });
}

// ============================================
// Authentication Helpers
// ============================================

export function createAuthHeader(userId: string): { Cookie: string } {
    // Mock session cookie for testing
    // In real tests, you'd use next-auth's test utilities
    return {
        Cookie: `next-auth.session-token=test-session-${userId}`,
    };
}

// ============================================
// API Request Helpers
// ============================================

export function createMockRequest(
    method: string,
    body?: any,
    headers?: Record<string, string>
): NextRequest {
    return new NextRequest('http://localhost:3000/api/test', {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
}

// ============================================
// Validation Helpers
// ============================================

export function expectValidationError(response: Response, field?: string) {
    expect(response.status).toBe(400);
    // Additional validation error checks can be added here
}

export function expectUnauthorized(response: Response) {
    expect(response.status).toBe(401);
}

export function expectNotFound(response: Response) {
    expect(response.status).toBe(404);
}

export function expectSuccess(response: Response) {
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
}
