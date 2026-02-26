import { PrismaClient, AssetStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting simplified database seed...');

    // Create admin user
    const hashedPassword = await bcrypt.hash('password123', 10);

    const admin = await prisma.user.create({
        data: {
            name: 'Admin User',
            email: 'admin@glanus.com',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    console.log('✅ Created admin user');

    // Create a simple laptop asset (no nested creates)
    const laptop = await prisma.asset.create({
        data: {
            assetType: 'PHYSICAL',
            name: 'MacBook Pro 16" 2023',
            manufacturer: 'Apple',
            model: 'MacBook Pro',
            serialNumber: 'SIMPLE-001',
            status: AssetStatus.AVAILABLE,
            assignedToId: admin.id,
            workspaceId: '', // Will be set after workspace creation
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- seed script
    });

    console.log('✅ Created sample laptop asset');

    // Create a simple SaaS asset (no nested creates)
    const saas = await prisma.asset.create({
        data: {
            assetType: 'DIGITAL',
            name: 'GitHub Enterprise',
            manufacturer: 'GitHub Inc.',
            serialNumber: 'SIMPLE-002',
            status: AssetStatus.AVAILABLE,
            assignedToId: admin.id,
            workspaceId: '', // Will be set after workspace creation
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- seed script
    });

    console.log('✅ Created sample SaaS asset');

    console.log('');
    console.log('🎉 Simplified seed completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Users: 1 (admin)`);
    console.log(`   - Assets: 2 (1 laptop, 1 SaaS)`);
    console.log('');
    console.log('⚠️  Note: This is a minimal seed for basic testing.');
    console.log('   Use the dynamic asset APIs to create assets with full data.');
    console.log('');
    console.log('🔐 Login: admin@glanus.com / password123');
}

main()
    .catch((e) => {
        console.error('❌ Error during seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
