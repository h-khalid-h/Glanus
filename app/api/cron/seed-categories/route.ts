import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { withErrorHandler } from '@/lib/api/withAuth';
import { AssetType } from '@prisma/client';
import crypto from 'crypto';

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
export const POST = withErrorHandler(async (request: NextRequest) => {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const secret = process.env.CRON_SECRET || '';
    if (!token || !secret || token.length !== secret.length ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
        return apiError(401, 'Unauthorized');
    }

    const results = [];
    for (const cat of DEFAULT_CATEGORIES) {
        const existing = await prisma.assetCategory.findFirst({ where: { slug: cat.slug } });
        if (!existing) {
            const created = await prisma.assetCategory.create({ data: cat });
            results.push({ action: 'created', name: created.name, id: created.id });
        } else {
            results.push({ action: 'exists', name: existing.name, id: existing.id });
        }
    }

    return apiSuccess({ message: `Seeded ${results.filter(r => r.action === 'created').length} categories`, results });
});
