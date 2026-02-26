/**
 * Data Migration: Make Asset.workspaceId Required
 * 
 * This script assigns orphaned assets (workspaceId IS NULL) to a workspace.
 * Run this BEFORE applying the Prisma migration that makes workspaceId required.
 * 
 * Usage:
 *   npx ts-node prisma/migrations/assign-asset-workspaces.ts
 * 
 * Strategy:
 *   1. Find all assets with NULL workspaceId
 *   2. For each asset, assign to the owner's first workspace (or a default workspace)
 *   3. Report results
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Finding assets with NULL workspaceId...');

    const orphanedAssets = await prisma.asset.findMany({
        where: { workspaceId: null as any }, // eslint-disable-line @typescript-eslint/no-explicit-any -- migration script for pre-required field
        include: {
            assignedTo: {
                include: {
                    ownedWorkspaces: { take: 1 },
                    workspaceMemberships: {
                        include: { workspace: true },
                        take: 1,
                    },
                },
            },
        },
    });

    if (orphanedAssets.length === 0) {
        console.log('✅ No orphaned assets found. All assets already have a workspaceId.');
        return;
    }

    console.log(`📦 Found ${orphanedAssets.length} orphaned assets.`);

    // Get or create a default workspace for truly unassigned assets
    let defaultWorkspace = await prisma.workspace.findFirst({
        orderBy: { createdAt: 'asc' },
    });

    if (!defaultWorkspace) {
        console.log('⚠️  No workspaces exist. Cannot assign assets. Create a workspace first.');
        process.exit(1);
    }

    let assigned = 0;
    let defaulted = 0;

    for (const asset of orphanedAssets) {
        let targetWorkspaceId: string;

        // Try to find a workspace through the assigned user
        if ((asset as any).assignedTo) {
            const userWorkspace =
                (asset as any).assignedTo.ownedWorkspaces[0] ||
                (asset as any).assignedTo.workspaceMemberships[0]?.workspace;

            if (userWorkspace) {
                targetWorkspaceId = userWorkspace.id;
            } else {
                targetWorkspaceId = defaultWorkspace.id;
                defaulted++;
            }
        } else {
            targetWorkspaceId = defaultWorkspace.id;
            defaulted++;
        }

        await prisma.asset.update({
            where: { id: asset.id },
            data: { workspaceId: targetWorkspaceId },
        });

        assigned++;
        console.log(`  ✓ Asset "${asset.name}" → workspace ${targetWorkspaceId}`);
    }

    console.log('');
    console.log('🎉 Migration complete!');
    console.log(`   Assigned: ${assigned} assets`);
    console.log(`   Via user workspace: ${assigned - defaulted}`);
    console.log(`   Via default workspace: ${defaulted}`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Verify the assignments are correct');
    console.log('   2. Update schema: change workspaceId to String (required) and workspace to Workspace (required)');
    console.log('   3. Run: npx prisma migrate dev --name make-asset-workspace-required');
}

main()
    .catch((e) => {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
