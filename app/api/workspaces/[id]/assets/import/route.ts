import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { AssetBulkService } from '@/lib/services/AssetBulkService';

/**
 * POST /api/workspaces/[id]/assets/import
 * Import assets from CSV. Expects multipart/form-data with 'file' field.
 * CSV format: name,assetType,status,manufacturer,model,serialNumber,location,categoryName
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(params.id, user.id);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return apiError(400, 'No file provided. Upload a CSV file.');
    if (!file.name.endsWith('.csv')) return apiError(400, 'File must be a .csv file.');
    const allowedMimeTypes = ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'];
    if (file.type && !allowedMimeTypes.includes(file.type)) return apiError(400, 'Invalid file type. Only CSV files are accepted.');
    if (file.size > 5 * 1024 * 1024) return apiError(400, 'File size exceeds 5MB limit.');

    const csvText = await file.text();
    const result = await AssetBulkService.importCSV(params.id, user.id, file.name, csvText);

    return apiSuccess(result, {
        message: `Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors.`,
    });
});
