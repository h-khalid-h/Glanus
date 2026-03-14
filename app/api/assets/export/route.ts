import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiError } from '@/lib/api/response';
import { AssetService } from '@/lib/services/AssetService';

// GET /api/assets/export - Export workspace assets to CSV
export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) return apiError(400, 'Workspace ID is required');

    await requireWorkspaceRole(workspaceId, user.id, 'VIEWER');

    const csvContent = await AssetService.exportAssets(workspaceId);

    return new NextResponse(csvContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="assets_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
    });
});
