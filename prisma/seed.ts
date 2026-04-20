import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed (idempotent — safe to re-run)...');

    // ─── Platform Roles ───────────────────────────────────────────────────────
    const roleDefs = [
        { name: 'SUPER_ADMIN', label: 'Super Admin',    description: 'Full platform access — all permissions granted', isStaff: true,  color: '#f59e0b' },
        { name: 'ADMIN',       label: 'Administrator',  description: 'Full super-admin dashboard access',              isStaff: true,  color: '#ef4444' },
        { name: 'IT_STAFF',    label: 'IT Staff',       description: 'Workspace support & IT operations',              isStaff: true,  color: '#6366f1' },
        { name: 'USER',        label: 'User',           description: 'Regular platform user',                          isStaff: false, color: '#64748b' },
    ];

    const platformRoles: Record<string, { id: string }> = {};
    for (const def of roleDefs) {
        const r = await prisma.platformRole.upsert({
            where:  { name: def.name },
            create: { name: def.name, label: def.label, description: def.description, isStaff: def.isStaff, color: def.color },
            update: { label: def.label, description: def.description, isStaff: def.isStaff, color: def.color },
        });
        platformRoles[def.name] = r;
    }

    console.log('✅ Seeded platform roles');

    // ─── Super-Admin Staff User ───────────────────────────────────────────────
    const password = process.env.SUPER_ADMIN_SEED_PASSWORD || 'Admin@Glanus@1999@';
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.upsert({
        where: { email: 'a.ragab@datac.com' },
        create: {
            name: 'Alaa Ragab',
            email: 'a.ragab@datac.com',
            password: hashedPassword,
                role: 'ADMIN',
            isStaff: true,
            isActive: true,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            onboardingCompleted: true,
            platformRoleId: platformRoles['SUPER_ADMIN'].id,
        },
        update: {
            name: 'A. Ragab',
            role: 'ADMIN',
            isStaff: true,
            isActive: true,
            platformRoleId: platformRoles['SUPER_ADMIN'].id,
        },
    });

    console.log('✅ Seeded super-admin user: a.ragab@datac.com');

    console.log('');
    console.log('🎉 Seed completed.');
    console.log('');
    console.log('🔐 Super-admin login:');
    console.log('   Email:    a.ragab@datac.com');
    console.log('   Password: (as configured)');
}

main()
    .catch((e) => {
        console.error('❌ Error during seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

