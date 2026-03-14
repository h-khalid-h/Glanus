import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspaceService } from '@/lib/services/WorkspaceService';

// GET /api/workspaces/[id]
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(id, user.id, 'OWNER', request);

    try {
        const workspace = await WorkspaceService.getWorkspace(id);
        return apiSuccess({ workspace });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// PATCH /api/workspaces/[id]
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(id, user.id, 'ADMIN', request);

    const body = await request.json();
    try {
        const workspace = await WorkspaceService.updateWorkspace(id, user.id, body);
        return apiSuccess({ workspace });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// DELETE /api/workspaces/[id]
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(id, user.id, 'OWNER', request);

    try {
        await WorkspaceService.deleteWorkspace(id, user.id);
        return apiSuccess({ message: 'Workspace deleted' });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
