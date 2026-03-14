import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { InvitationService } from '@/lib/services/InvitationService';
import { z } from 'zod';

const inviteSchema = z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workspaces/[id]/invitations - List pending invitations
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const invitations = await InvitationService.listInvitations(workspaceId);
    return apiSuccess({ invitations });
});

// POST /api/workspaces/[id]/invitations - Send invitation (ADMIN or higher)
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    const { workspace } = await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const body = await request.json();
    const validation = inviteSchema.safeParse(body);
    if (!validation.success) return apiError(400, 'Validation failed', validation.error.errors);

    const result = await InvitationService.createInvitation(
        workspaceId, user.id, workspace.name, validation.data,
    );
    return apiSuccess(result, undefined, 201);
});
