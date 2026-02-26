#!/usr/bin/env ts-node

/**
 * Migration Script: Workspace Multi-Tenant Setup
 * 
 * This script migrates existing Glanus installation from single-tenant to multi-tenant.
 * 
 * What it does:
 * 1. Creates a "Default Workspace" for existing data
 * 2. Migrates all existing assets to the default workspace 
 * 3. Adds all existing users as members of the default workspace
 * 4. Creates a TEAM subscription for the default workspace
 * 
 * Usage:
 *   npm run migrate:workspaces
 * 
 * Or:
 *   npx ts-node scripts/migrate-to-workspaces.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting workspace migration...\n');

    try {
        // Step 1: Check if migration already ran
        const existingWorkspaces = await prisma.workspace.count();
        if (existingWorkspaces > 0) {
            console.log('⚠️  Workspaces already exist. Migration may have already run.');
            console.log(`   Found ${existingWorkspaces} workspace(s).\n`);

            const proceed = process.env.FORCE_MIGRATION === 'true';
            if (!proceed) {
                console.log('   Set FORCE_MIGRATION=true to run anyway.');
                console.log('   Aborting.');
                return;
            }
        }

        // Step 2: Get all users
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'asc' },
        });

        console.log(`📊 Found ${users.length} user(s)\n`);

        if (users.length === 0) {
            console.log('⚠️  No users found. Creating a default admin user...\n');
            // Could create default user here, but for now just exit
            console.log('   Please create at least one user first.');
            return;
        }

        // Step 3: Find first admin or use first user as owner
        const owner = users.find((u) => u.role === 'ADMIN') || users[0];
        console.log(`👤 Workspace owner: ${owner.name || owner.email} (${owner.role})\n`);

        // Step 4: Get counts
        const assetCount = await prisma.asset.count();
        const categoryCount = await prisma.assetCategory.count();

        console.log(`📦 Assets to migrate: ${assetCount}`);
        console.log(`🏷️  Categories: ${categoryCount}\n`);

        // Step 5: Create default workspace with subscription
        console.log('✨ Creating default workspace...');

        const workspace = await prisma.$transaction(async (tx) => {
            // Create workspace
            const ws = await tx.workspace.create({
                data: {
                    name: 'Default Workspace',
                    slug: 'default',
                    description: 'Auto-created workspace for existing data',
                    primaryColor: '#3B82F6',
                    accentColor: '#10B981',
                    ownerId: owner.id,
                },
            });

            console.log(`✅ Workspace created: ${ws.name} (${ws.slug})`);

            // Create subscription (TEAM plan with high limits)
            await tx.subscription.create({
                data: {
                    workspaceId: ws.id,
                    plan: 'TEAM',
                    status: 'ACTIVE',
                    maxAssets: 1000, // Generous limit for migration
                    maxAICreditsPerMonth: 10000,
                    maxStorageMB: 102400, // 100 GB
                },
            });

            console.log(`✅ Subscription created: TEAM plan`);

            return ws;
        });

        // Step 6: Migrate assets to workspace
        console.log(`\n📦 Migrating ${assetCount} assets to workspace...`);

        const updateResult = await prisma.asset.updateMany({
            where: { workspaceId: null as any }, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-required field migration
            data: { workspaceId: workspace.id },
        });

        console.log(`✅ ${updateResult.count} assets migrated`);

        // Step 7: Add all users as workspace members
        console.log(`\n👥 Adding ${users.length} user(s) as workspace members...`);

        let memberCount = 0;
        for (const user of users) {
            // Skip owner (already has access)
            if (user.id === owner.id) {
                console.log(`   ⏭️  Skipping owner: ${user.email}`);
                continue;
            }

            await prisma.workspaceMember.create({
                data: {
                    workspaceId: workspace.id,
                    userId: user.id,
                    role: user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
                },
            });

            memberCount++;
            console.log(`   ✅ Added: ${user.email} as ${user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'}`);
        }

        console.log(`\n✅ ${memberCount} member(s) added (+ 1 owner)\n`);

        // Step 8: Verification
        console.log('🔍 Verifying migration...');

        const workspaceData = await prisma.workspace.findUnique({
            where: { id: workspace.id },
            include: {
                subscription: true,
                members: true,
                _count: {
                    select: {
                        assets: true,
                        members: true,
                    },
                },
            },
        });

        console.log(`   Workspace: ${workspaceData?.name}`);
        console.log(`   Assets: ${workspaceData?._count.assets}`);
        console.log(`   Members: ${(workspaceData?._count?.members ?? 0) + 1} (including owner)`);
        console.log(`   Plan: ${(workspaceData as any)?.subscription?.plan}`);

        // Step 9: Check for orphaned assets
        const orphanedAssets = await prisma.asset.count({
            where: { workspaceId: null as any }, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-required field migration
        });

        if (orphanedAssets > 0) {
            console.log(`\n⚠️  WARNING: ${orphanedAssets} asset(s) still have null workspaceId`);
        } else {
            console.log(`\n✅ No orphaned assets found`);
        }

        console.log('\n🎉 Migration completed successfully!\n');
        console.log('Next steps:');
        console.log('1. Test workspace isolation');
        console.log('2. Verify asset queries return correct data');
        console.log('3. Test team member invitations');
        console.log('4. Make workspaceId required in schema (future migration)\n');

    } catch (error: unknown) {
        console.error('\n❌ Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
