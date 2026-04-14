import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { withCronHandler } from '@/lib/api/withAuth';
import { AssetType } from '@prisma/client';

const DEFAULT_CATEGORIES: Array<{ name: string; slug: string; icon: string; description: string; assetTypeValue: AssetType; sortOrder: number }> = [
    { name: 'Servers', slug: 'servers', icon: '🖥️', description: 'Physical and virtual server infrastructure', assetTypeValue: 'PHYSICAL', sortOrder: 1 },
    { name: 'Workstations', slug: 'workstations', icon: '💻', description: 'Employee laptops and desktops', assetTypeValue: 'PHYSICAL', sortOrder: 2 },
    { name: 'Network Equipment', slug: 'network-equipment', icon: '🌐', description: 'Switches, routers, firewalls, and access points', assetTypeValue: 'PHYSICAL', sortOrder: 3 },
    { name: 'Mobile Devices', slug: 'mobile-devices', icon: '📱', description: 'Phones, tablets, and portable devices', assetTypeValue: 'PHYSICAL', sortOrder: 4 },
    { name: 'Peripherals', slug: 'peripherals', icon: '🖨️', description: 'Printers, monitors, docking stations', assetTypeValue: 'PHYSICAL', sortOrder: 5 },
    { name: 'SaaS Applications', slug: 'saas-applications', icon: '☁️', description: 'Cloud-hosted software subscriptions', assetTypeValue: 'DIGITAL', sortOrder: 6 },
    { name: 'Software Licenses', slug: 'software-licenses', icon: '🔑', description: 'On-premise and perpetual software licenses', assetTypeValue: 'DIGITAL', sortOrder: 7 },
    { name: 'Domains & Certificates', slug: 'domains-certificates', icon: '🔒', description: 'Domain names, SSL certs, and DNS records', assetTypeValue: 'DIGITAL', sortOrder: 8 },
];

// POST /api/cron/seed-categories
export const POST = withCronHandler(async (request: NextRequest) => {
    const body = await request.json().catch(() => ({}));
    const workspaceId: string | undefined = body?.workspaceId;
    if (!workspaceId) {
        return apiSuccess({ message: 'No workspaceId provided; nothing seeded', results: [] });
    }

    const results = await prisma.$transaction(async (tx) => {
        const out = [];
        for (const cat of DEFAULT_CATEGORIES) {
            const record = await tx.assetCategory.upsert({
                where: { workspaceId_slug: { workspaceId, slug: cat.slug } },
                update: {},
                create: { ...cat, workspaceId },
            });
            out.push({ action: 'created', name: record.name, id: record.id });
        }
        return out;
    });

    return apiSuccess({ message: `Seeded ${results.filter(r => r.action === 'created').length} categories`, results });
});
