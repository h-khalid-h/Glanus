import { PrismaClient, AssetStatus, AssetType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Safety guard: never run seed in production
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            '🚫 Seed script cannot be run in production! ' +
            'Set NODE_ENV to "development" or "test" to proceed.'
        );
    }

    console.log('🌱 Starting database seed...');

    // Clear existing data in correct order (respect foreign keys) using Postgres TRUNCATE CASCADE
    const tableNames = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    for (const { tablename } of tableNames) {
        if (tablename !== '_prisma_migrations') {
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
        }
    }

    console.log('🗑️  Cleared existing data');

    // Use env-driven password or default for development only
    const seedPassword = process.env.SEED_PASSWORD || 'password123';
    const hashedPassword = await bcrypt.hash(seedPassword, 12);

    const admin = await prisma.user.create({
        data: {
            name: 'Admin User',
            email: 'admin@glanus.com',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    const user1 = await prisma.user.create({
        data: {
            name: 'John Developer',
            email: 'john@glanus.com',
            password: hashedPassword,
            role: 'USER',
        },
    });

    const user2 = await prisma.user.create({
        data: {
            name: 'Jane Designer',
            email: 'jane@glanus.com',
            password: hashedPassword,
            role: 'USER',
        },
    });

    const staff = await prisma.user.create({
        data: {
            name: 'IT Staff',
            email: 'staff@glanus.com',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    console.log('✅ Created users');

    // Create a Workspace for the Admin user
    const workspace = await prisma.workspace.create({
        data: {
            name: 'Acme Corporation',
            slug: 'acme-corp',
            description: 'Global manufacturing headquarters',
            ownerId: admin.id,
            subscription: {
                create: {
                    plan: 'ENTERPRISE',
                    status: 'ACTIVE',
                    maxAssets: 1000,
                    maxAICreditsPerMonth: 5000,
                    maxStorageMB: 51200,
                }
            },
            members: {
                createMany: {
                    data: [
                        { userId: admin.id, role: 'OWNER' },
                        { userId: user1.id, role: 'MEMBER' },
                        { userId: user2.id, role: 'MEMBER' },
                        { userId: staff.id, role: 'ADMIN' },
                    ]
                }
            }
        }
    });

    console.log('✅ Created Primary Workspace (Acme Corp)');

    // Create sample assets (simplified - no nested PhysicalAsset/DigitalAsset)
    const laptop1 = await prisma.asset.create({
        data: {
            assetType: 'PHYSICAL',
            name: 'MacBook Pro 16" 2023',
            description: 'High-performance laptop for development',
            workspaceId: workspace.id,
            manufacturer: 'Apple',
            model: 'MacBook Pro',
            serialNumber: 'MBP2023001',
            status: AssetStatus.ASSIGNED,
            purchaseDate: new Date('2023-06-15'),
            purchaseCost: 2499.99,
            warrantyUntil: new Date('2026-06-15'),
            location: 'Office - Floor 2',
            assignedToId: user1.id,
        },
    });

    const laptop2 = await prisma.asset.create({
        data: {
            assetType: 'PHYSICAL',
            name: 'Dell XPS 15',
            description: 'Powerful Windows laptop',
            workspaceId: workspace.id,
            manufacturer: 'Dell',
            model: 'XPS 15',
            serialNumber: 'XPS2023002',
            status: AssetStatus.ASSIGNED,
            purchaseDate: new Date('2023-08-20'),
            purchaseCost: 1899.99,
            warrantyUntil: new Date('2026-08-20'),
            location: 'Office - Floor 3',
            assignedToId: user2.id,
        },
    });

    const server = await prisma.asset.create({
        data: {
            assetType: 'PHYSICAL',
            name: 'Dell PowerEdge R740',
            description: 'Production database server',
            workspaceId: workspace.id,
            manufacturer: 'Dell',
            model: 'PowerEdge R740',
            serialNumber: 'SRV2023004',
            status: AssetStatus.ASSIGNED,
            purchaseDate: new Date('2022-03-15'),
            purchaseCost: 8999.99,
            warrantyUntil: new Date('2027-03-15'),
            location: 'Data Center - Rack A3',
            assignedToId: staff.id,
        },
    });

    const saasApp = await prisma.asset.create({
        data: {
            assetType: 'DIGITAL',
            name: 'GitHub Enterprise',
            description: 'Source code management platform',
            workspaceId: workspace.id,
            manufacturer: 'GitHub Inc.',
            serialNumber: 'GH-ENT-2023',
            status: AssetStatus.ASSIGNED,
            purchaseDate: new Date('2023-01-01'),
            purchaseCost: 21.00,
            location: 'Cloud',
            assignedToId: staff.id,
        },
    });

    const phone = await prisma.asset.create({
        data: {
            assetType: 'PHYSICAL',
            name: 'iPhone 15 Pro',
            description: 'Company mobile device',
            workspaceId: workspace.id,
            manufacturer: 'Apple',
            model: 'iPhone 15 Pro',
            serialNumber: 'IPH2024001',
            status: AssetStatus.ASSIGNED,
            purchaseDate: new Date('2024-01-10'),
            purchaseCost: 1199.99,
            warrantyUntil: new Date('2026-01-10'),
            location: 'Office - Floor 2',
            assignedToId: admin.id,
        },
    });

    console.log('✅ Created assets (5 assets: 4 physical, 1 digital)');

    // ── Agent Connections (3 agents: 2 ONLINE, 1 OFFLINE) ──
    const agent1 = await prisma.agentConnection.create({
        data: {
            assetId: laptop1.id,
            workspaceId: workspace.id,
            agentVersion: '1.4.2',
            platform: 'MACOS',
            hostname: 'johns-macbook',
            ipAddress: '192.168.1.101',
            macAddress: 'AA:BB:CC:DD:EE:01',
            authToken: `agent_${crypto.randomUUID()}`,
            status: 'ONLINE',
            lastSeen: new Date(),
            cpuUsage: 42.5,
            ramUsage: 68.2,
            diskUsage: 55.0,
        },
    });

    const agent2 = await prisma.agentConnection.create({
        data: {
            assetId: server.id,
            workspaceId: workspace.id,
            agentVersion: '1.4.2',
            platform: 'LINUX',
            hostname: 'prod-db-server',
            ipAddress: '10.0.0.50',
            macAddress: 'AA:BB:CC:DD:EE:02',
            authToken: `agent_${crypto.randomUUID()}`,
            status: 'ONLINE',
            lastSeen: new Date(),
            cpuUsage: 78.3,
            ramUsage: 82.1,
            diskUsage: 45.0,
        },
    });

    const agent3 = await prisma.agentConnection.create({
        data: {
            assetId: laptop2.id,
            workspaceId: workspace.id,
            agentVersion: '1.3.8',
            platform: 'WINDOWS',
            hostname: 'janes-xps',
            ipAddress: '192.168.1.102',
            macAddress: 'AA:BB:CC:DD:EE:03',
            authToken: `agent_${crypto.randomUUID()}`,
            status: 'OFFLINE',
            lastSeen: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
            cpuUsage: null,
            ramUsage: null,
            diskUsage: null,
        },
    });

    console.log('✅ Created agents (3: 2 online, 1 offline)');

    // ── Agent Metrics (historical data for system health) ──
    const now = new Date();
    for (let i = 0; i < 10; i++) {
        const ts = new Date(now.getTime() - i * 5 * 60 * 1000); // Every 5 min
        await prisma.agentMetric.create({
            data: {
                agentId: agent1.id,
                assetId: laptop1.id,
                timestamp: ts,
                cpuUsage: 35 + Math.random() * 20,
                ramUsage: 60 + Math.random() * 15,
                ramUsed: 10.5 + Math.random() * 2,
                ramTotal: 16,
                diskUsage: 50 + Math.random() * 10,
                diskUsed: 250 + Math.random() * 50,
                diskTotal: 512,
                networkUp: 150 + Math.random() * 100,
                networkDown: 500 + Math.random() * 300,
            },
        });
        await prisma.agentMetric.create({
            data: {
                agentId: agent2.id,
                assetId: server.id,
                timestamp: ts,
                cpuUsage: 70 + Math.random() * 20,
                ramUsage: 75 + Math.random() * 15,
                ramUsed: 48 + Math.random() * 10,
                ramTotal: 64,
                diskUsage: 40 + Math.random() * 10,
                diskUsed: 800 + Math.random() * 100,
                diskTotal: 2048,
                networkUp: 500 + Math.random() * 200,
                networkDown: 2000 + Math.random() * 1000,
            },
        });
    }

    console.log('✅ Created agent metrics (20 data points)');

    // ── Alert Rules ──
    await prisma.alertRule.createMany({
        data: [
            {
                workspaceId: workspace.id,
                name: 'High CPU Usage Alert',
                enabled: true,
                metric: 'CPU',
                threshold: 80,
                duration: 5,
                severity: 'CRITICAL',
                notifyEmail: true,
                notifyWebhook: true,
                createdBy: admin.id,
            },
            {
                workspaceId: workspace.id,
                name: 'Disk Space Warning',
                enabled: true,
                metric: 'DISK',
                threshold: 90,
                duration: 0,
                severity: 'WARNING',
                notifyEmail: true,
                notifyWebhook: false,
                createdBy: admin.id,
            },
        ],
    });

    console.log('✅ Created alert rules (2: CPU critical, DISK warning)');

    // ── Notification Webhook ──
    await prisma.notificationWebhook.create({
        data: {
            workspaceId: workspace.id,
            url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX',
            enabled: true,
            secret: 'whsec_test_secret_for_development',
        },
    });

    console.log('✅ Created notification webhook');

    // ── AI Insights ──
    await prisma.aIInsight.createMany({
        data: [
            {
                workspaceId: workspace.id,
                assetId: server.id,
                title: 'Unusual CPU spike pattern on prod-db-server',
                description: 'CPU usage has been trending 25% above baseline during off-hours (2AM-5AM). This pattern often indicates a runaway background process or unauthorized workload.',
                type: 'ANOMALY',
                severity: 'WARNING',
                confidence: 0.87,
                acknowledged: false,
                metadata: { baseline: 45, current: 78, period: 'off-hours' },
            },
            {
                workspaceId: workspace.id,
                assetId: laptop1.id,
                title: 'Disk degradation predicted for MacBook Pro',
                description: 'Based on write patterns over the past 30 days, SSD health is projected to reach warning threshold within 6 months. Consider scheduling a drive replacement.',
                type: 'PREDICTION',
                severity: 'INFO',
                confidence: 0.72,
                acknowledged: false,
                metadata: { currentHealth: 92, projectedHealth: 78, timeframe: '6 months' },
            },
            {
                workspaceId: workspace.id,
                assetId: null,
                title: 'License utilization below optimal for GitHub Enterprise',
                description: 'Only 3 of 10 purchased GitHub Enterprise seats are actively used. Consider downgrading to the Team plan to save approximately $1,680/year.',
                type: 'COST_OPTIMIZATION',
                severity: 'INFO',
                confidence: 0.95,
                acknowledged: true,
                metadata: { activeSeats: 3, totalSeats: 10, potentialSavings: 1680 },
            },
        ],
    });

    console.log('✅ Created AI insights (3: anomaly, prediction, cost optimization)');

    // ── Audit Log Events ──
    await prisma.auditLog.createMany({
        data: [
            {
                workspaceId: workspace.id,
                userId: admin.id,
                action: 'workspace.created',
                resourceType: 'Workspace',
                resourceId: workspace.id,
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
            {
                workspaceId: workspace.id,
                userId: admin.id,
                action: 'asset.created',
                resourceType: 'Asset',
                resourceId: laptop1.id,
                assetId: laptop1.id,
                createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            },
            {
                workspaceId: workspace.id,
                userId: staff.id,
                action: 'agent.registered',
                resourceType: 'AgentConnection',
                resourceId: agent1.id,
                assetId: laptop1.id,
                createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            },
            {
                workspaceId: workspace.id,
                userId: admin.id,
                action: 'alert_rule.created',
                resourceType: 'AlertRule',
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            },
            {
                workspaceId: workspace.id,
                userId: admin.id,
                action: 'member.invited',
                resourceType: 'WorkspaceMember',
                resourceId: user1.id,
                metadata: { email: 'john@glanus.com', role: 'MEMBER' },
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            },
        ],
    });

    console.log('✅ Created audit log entries (5 events)');

    // ── Second Workspace (FREE plan — sparse data) ──
    const workspace2 = await prisma.workspace.create({
        data: {
            name: 'Startup Inc',
            slug: 'startup-inc',
            description: 'Early-stage tech startup',
            ownerId: user1.id,
            subscription: {
                create: {
                    plan: 'FREE',
                    status: 'ACTIVE',
                    maxAssets: 5,
                    maxAICreditsPerMonth: 100,
                    maxStorageMB: 1024,
                },
            },
            members: {
                createMany: {
                    data: [
                        { userId: user1.id, role: 'OWNER' },
                        { userId: user2.id, role: 'MEMBER' },
                    ],
                },
            },
        },
    });

    await prisma.asset.create({
        data: {
            assetType: 'PHYSICAL',
            name: 'Office Printer',
            description: 'Shared office printer/scanner',
            workspaceId: workspace2.id,
            manufacturer: 'HP',
            model: 'LaserJet Pro M428fdw',
            serialNumber: 'HP-PRINT-001',
            status: AssetStatus.AVAILABLE,
            location: 'Front Office',
        },
    });

    console.log('✅ Created Second Workspace (Startup Inc - FREE plan)');

    console.log('');
    console.log('🎉 Database seed completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Users: 4 (2 admin, 2 regular)`);
    console.log(`   - Workspaces: 2 (Acme Corp ENTERPRISE, Startup Inc FREE)`);
    console.log(`   - Assets: 6 (5 in Acme, 1 in Startup)`);
    console.log(`   - Agents: 3 (2 online, 1 offline)`);
    console.log(`   - Agent Metrics: 20 data points`);
    console.log(`   - Alert Rules: 2 (CPU critical, disk warning)`);
    console.log(`   - Notification Webhook: 1`);
    console.log(`   - AI Insights: 3 (anomaly, prediction, cost)`);
    console.log(`   - Audit Logs: 5 events`);
    console.log('');
    console.log('🔐 Login credentials:');
    console.log('   Admin: admin@glanus.com / password123');
    console.log('   User:  john@glanus.com / password123');
}

main()
    .catch((e) => {
        console.error('❌ Error during seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
