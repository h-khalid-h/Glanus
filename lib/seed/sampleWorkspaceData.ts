import { logError, logInfo } from '@/lib/logger';
/**
 * Sample Workspace Data Generator
 * Creates demo data for new workspace onboarding
 */

import { Prisma } from '@prisma/client';
import type { prisma as PrismaInstance } from '@/lib/db';

export interface SampleDataOptions {
    workspaceId: string;
    userId: string;
}

/**
 * Generate sample assets for a new workspace
 */
export function generateSampleAssets(options: SampleDataOptions): Prisma.AssetCreateManyInput[] {
    const { workspaceId, userId } = options;

    return [
        {
            workspaceId,
            assetType: 'PHYSICAL',
            name: 'MacBook Pro 16" (Sample)',
            manufacturer: 'Apple',
            model: 'MBP16-2023',
            serialNumber: `DEMO-${Math.random().toString(36).substring(7).toUpperCase()}`,
            status: 'AVAILABLE',
            description: 'Sample laptop asset - this is demonstration data',
            purchaseDate: new Date('2023-01-15'),
            purchaseCost: 2499.99,
            warrantyUntil: new Date('2026-01-15'),
            tags: ['laptop', 'sample', 'demo'],
        },
        {
            workspaceId,
            assetType: 'PHYSICAL',
            name: 'Dell Monitor 27" (Sample)',
            manufacturer: 'Dell',
            model: 'U2720Q',
            serialNumber: `DEMO-${Math.random().toString(36).substring(7).toUpperCase()}`,
            status: 'AVAILABLE',
            description: 'Sample monitor - demonstration data',
            purchaseDate: new Date('2023-03-20'),
            purchaseCost: 549.99,
            tags: ['monitor', 'sample', 'demo'],
        },
        {
            workspaceId,
            assetType: 'DIGITAL',
            name: 'Adobe Creative Cloud (Sample)',
            manufacturer: 'Adobe',
            model: 'CC-2024',
            status: 'ASSIGNED',
            description: 'Sample software license - demonstration data',
            purchaseDate: new Date('2024-01-01'),
            purchaseCost: 599.88,
            tags: ['software', 'subscription', 'sample', 'demo'],
        },
    ];
}

/**
 * Generate a sample location for a new workspace
 */
export function generateSampleLocation(options: SampleDataOptions): Prisma.LocationCreateInput {
    const { workspaceId } = options;

    return {
        workspace: { connect: { id: workspaceId } },
        name: 'Headquarters (Sample)',
        address: '123 Demo Street, Sample City, SC 12345',
        city: 'Sample City',
        country: 'United States',
    };
}

/**
 * Generate sample alert rules for monitoring
 */
export function generateSampleAlertRules(options: SampleDataOptions): Prisma.AlertRuleCreateManyInput[] {
    const { workspaceId } = options;

    return [
        {
            workspaceId,
            name: 'High CPU Usage Alert (Sample)',
            metric: 'CPU',
            threshold: 80,
            severity: 'WARNING',
            enabled: true,
        },
        {
            workspaceId,
            name: 'Critical Disk Space Alert (Sample)',
            metric: 'DISK',
            threshold: 90,
            severity: 'CRITICAL',
            enabled: true,
        },
    ];
}

/**
 * Create all sample data for a workspace
 */
export async function createSampleWorkspaceData(
    prisma: typeof PrismaInstance,
    options: SampleDataOptions
): Promise<void> {
    const { workspaceId, userId } = options;

    try {
        // Create sample assets
        const assets = generateSampleAssets(options);
        await prisma.asset.createMany({ data: assets });

        // Create sample location
        const location = generateSampleLocation(options);
        await prisma.location.create({ data: location });

        // Create sample alert rules
        const alertRules = generateSampleAlertRules(options);
        await prisma.alertRule.createMany({ data: alertRules });

        logInfo(`✓ Created sample data for workspace ${workspaceId}`);
    } catch (error: unknown) {
        logError('Failed to create sample data', error);
        throw error;
    }
}
