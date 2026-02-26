import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiError } from '@/lib/api/response';
import { verifyWorkspaceAccess } from '@/lib/workspace/utils';

// GET /api/assets/export - Export workspace assets to CSV
export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
        return apiError(400, 'Workspace ID is required');
    }

    const dbUser = await prisma.user.findUnique({
        where: { email: user.email! },
    });
    if (!dbUser) {
        return apiError(404, 'User not found');
    }

    const { hasAccess } = await verifyWorkspaceAccess(dbUser.id, workspaceId);
    if (!hasAccess) {
        return apiError(403, 'Access denied to workspace');
    }

    const assets = await prisma.asset.findMany({
        where: { workspaceId, deletedAt: null },
        include: {
            assignedTo: { select: { name: true, email: true } },
            category: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    const headers = [
        'ID', 'Name', 'Category', 'Manufacturer', 'Model', 'Serial Number',
        'Status', 'Location', 'Assigned To', 'Assigned Email',
        'Purchase Date', 'Purchase Cost', 'Warranty Until', 'Tags',
        'Description', 'Created At',
    ];

    const rows = assets.map(asset => [
        asset.id,
        asset.name,
        asset.category?.name || '',
        asset.manufacturer || '',
        asset.model || '',
        asset.serialNumber || '',
        asset.status,
        asset.location || '',
        asset.assignedTo?.name || '',
        asset.assignedTo?.email || '',
        asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
        asset.purchaseCost || '',
        asset.warrantyUntil ? new Date(asset.warrantyUntil).toISOString().split('T')[0] : '',
        Array.isArray(asset.tags) ? asset.tags.join('; ') : '',
        asset.description?.replace(/"/g, '""') || '',
        new Date(asset.createdAt).toISOString(),
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="assets_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
    });
});
