import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';
import { WorkspaceApiKeyService } from '@/lib/services/WorkspaceApiKeyService';

const createKeySchema = z.object({
    name: z.string().min(1, 'Key name is required').max(100),
    scopes: z.array(z.enum(['read', 'write', 'admin', 'agents', 'scripts'])).min(1, 'At least one scope is required'),
    expiresIn: z.enum(['never', '30d', '90d', '1y']).optional(),
});

// GET /api/workspaces/[id]/api-keys
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const keys = await WorkspaceApiKeyService.listApiKeys(workspaceId);
    return apiSuccess({ keys });
});

// POST /api/workspaces/[id]/api-keys
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const body = await request.json();
    const data = createKeySchema.parse(body);

    try {
        const key = await WorkspaceApiKeyService.createApiKey(workspaceId, user.id, data);
        return apiSuccess({ key }, { message: 'API key generated. Copy the key now — it will not be shown again.' }, 201);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// DELETE /api/workspaces/[id]/api-keys?keyId=...
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const url = new URL(request.url);
    const keyId = url.searchParams.get('keyId');
    if (!keyId) return apiError(400, 'keyId parameter is required.');

    try {
        await WorkspaceApiKeyService.revokeApiKey(workspaceId, keyId, user.id);
        return apiSuccess({ revoked: true }, { message: 'API key revoked successfully.' });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
