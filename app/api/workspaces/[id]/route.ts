import { prisma } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, requireWorkspaceAccess, requireWorkspaceRole, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { apiSuccess, apiError, apiDeleted } from '@/lib/api/response';


const updateWorkspaceSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    logo: z.string().url().optional().nullable(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// GET /api/workspaces/[id] - Get workspace details
export const GET = withErrorHandler(async (
    request: Request,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();
    const { workspace } = await requireWorkspaceAccess(params.id, user.id);

    // Fetch full workspace details
    const fullWorkspace = await prisma.workspace.findUnique({
        where: { id: params.id },
        include: {
            subscription: true,
            owner: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    assets: true,
                    members: true,
                    invitations: true,
                },
            },
        },
    });

    return apiSuccess({ workspace: fullWorkspace });
});

// PATCH /api/workspaces/[id] - Update workspace
export const PATCH = withErrorHandler(async (
    request: Request,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();

    // Require ADMIN or higher
    await requireWorkspaceRole(params.id, user.id, 'ADMIN');

    // Validate request body
    const body = await request.json();
    const validation = updateWorkspaceSchema.safeParse(body);

    if (!validation.success) {
        return apiError(400, 'Validation failed', validation.error.errors);
    }

    // Update workspace
    const updatedWorkspace = await prisma.workspace.update({
        where: { id: params.id },
        data: validation.data,
        include: {
            subscription: true,
            _count: {
                select: {
                    assets: true,
                    members: true,
                },
            },
        },
    });

    await prisma.auditLog.create({
        data: {
            action: 'WORKSPACE_UPDATED',
            resourceType: 'Workspace',
            resourceId: params.id,
            userId: user.id,
            metadata: { workspaceName: updatedWorkspace.name, changes: validation.data },
        },
    });

    return apiSuccess({ workspace: updatedWorkspace });
});

// DELETE /api/workspaces/[id] - Delete workspace
export const DELETE = withErrorHandler(async (
    request: Request,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();

    // Only OWNER can delete
    await requireWorkspaceRole(params.id, user.id, 'OWNER');

    // Log the deletion BEFORE cascade-deleting the workspace to avoid
    // integrity issues (audit log references may fail post-cascade).
    await prisma.auditLog.create({
        data: {
            action: 'WORKSPACE_DELETED',
            resourceType: 'Workspace',
            resourceId: params.id,
            userId: user.id,
            metadata: { deletedAt: new Date().toISOString() },
        },
    });

    // Delete workspace (cascade will handle related records)
    await prisma.workspace.delete({
        where: { id: params.id },
    });

    return apiSuccess({ message: 'Workspace deleted' });
});
