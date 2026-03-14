import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiError } from '@/lib/api/response';
import { WorkspaceReportService } from '@/lib/services/WorkspaceReportService';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const type = searchParams.get('type') || 'asset_inventory';

    if (format !== 'csv') return apiError(400, 'Currently only CSV format is supported for reports.');

    return WorkspaceReportService.generateReport(workspaceId, type);
});
