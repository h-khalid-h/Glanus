import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { enforceBodySize } from '@/lib/api/body-size';
import { enforceQuota, incrementStorageUsage } from '@/lib/workspace/quotas';
import { withRateLimit } from '@/lib/security/rateLimit';
import { StorageService } from '@/lib/services/StorageService';

/**
 * POST /api/workspaces/[id]/storage/upload
 *
 * Uploads a file/document to the workspace, enforcing the storage quota.
 * Expects FormData with a 'file' Blob/File.
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimitResponse = await withRateLimit(request, 'api');
    if (rateLimitResponse) return rateLimitResponse;

    // Enforce upload size limit (50 MB)
    const sizeError = enforceBodySize(request, 'upload');
    if (sizeError) return sizeError;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const workspaceId = params.id;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return apiError(400, 'No file provided in form data');

    const sizeMB = file.size / (1024 * 1024);

    // Enforce quota BEFORE upload
    await enforceQuota(workspaceId, 'storage_mb');

    // Simulate storage via DB metadata (stream to S3 in production)
    const fileId = crypto.randomUUID();
    await incrementStorageUsage(workspaceId, sizeMB);

    // Delegate audit log to service
    await StorageService.recordStorageUpload(
        workspaceId, user.id, fileId, file.name, sizeMB.toFixed(2), file.type,
    );

    return apiSuccess({
        id: fileId, name: file.name, sizeMB,
        url: `/api/workspaces/${workspaceId}/storage/${fileId}`,
        message: 'File successfully uploaded and storage quota consumed',
    }, undefined, 201);
});
