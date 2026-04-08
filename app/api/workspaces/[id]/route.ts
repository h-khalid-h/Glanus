import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceService } from '@/lib/services/WorkspaceService';
import { z } from 'zod';

const UpdateWorkspaceSchema = z.object({
    name: z.string().min(1, 'Workspace name is required').max(100).optional(),
    description: z.string().max(500).optional(),
    logoUrl: z.string().url().optional(),
    website: z.string().url().optional(),
    industry: z.string().optional(),
    size: z.string().optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workspaces/[id]
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: RouteContext,
) => {
    const { id } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(id, user.id, 'OWNER', request);
    const workspace = await WorkspaceService.getWorkspace(id);
    return apiSuccess({ workspace });
});

// PATCH /api/workspaces/[id]
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: RouteContext,
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(id, user.id, 'ADMIN', request);
    const body = UpdateWorkspaceSchema.parse(await request.json());
    const workspace = await WorkspaceService.updateWorkspace(id, user.id, body);
    return apiSuccess({ workspace });
});

// DELETE /api/workspaces/[id]
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: RouteContext,
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(id, user.id, 'OWNER', request);
    await WorkspaceService.deleteWorkspace(id, user.id);
    return apiSuccess({ message: 'Workspace deleted' });
});
