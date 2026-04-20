import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { z } from 'zod';
import type { WorkspaceRole } from '@prisma/client';

const VALID_WS_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'STAFF', 'MEMBER', 'VIEWER'];

const patchSchema = z.object({
    role: z.enum(['OWNER', 'ADMIN', 'STAFF', 'MEMBER', 'VIEWER']),
});

/**
 * PATCH /api/admin/workspaces/[workspaceId]/members/[memberId]
 * Update a member's workspace role. Staff-only.
 */
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; memberId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const { workspaceId, memberId } = await params;
    const body = await request.json();
    const { role } = patchSchema.parse(body);

    if (!VALID_WS_ROLES.includes(role)) {
        throw new ApiError(400, 'Invalid workspace role');
    }

    // Verify the member belongs to this workspace
    const existing = await prisma.workspaceMember.findFirst({
        where: { id: memberId, workspaceId },
    });

    if (!existing) {
        throw new ApiError(404, 'Workspace member not found');
    }

    const member = await prisma.workspaceMember.update({
        where: { id: memberId },
        data: { role },
        select: {
            id: true,
            role: true,
            joinedAt: true,
            user: { select: { id: true, email: true, name: true } },
        },
    });

    return apiSuccess({ member });
});

/**
 * DELETE /api/admin/workspaces/[workspaceId]/members/[memberId]
 * Remove a member from the workspace. Staff-only.
 */
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; memberId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const { workspaceId, memberId } = await params;

    // Check the member exists and is not the owner
    const member = await prisma.workspaceMember.findFirst({
        where: { id: memberId, workspaceId },
        include: { workspace: { select: { ownerId: true } } },
    });

    if (!member) {
        throw new ApiError(404, 'Workspace member not found');
    }

    if (member.userId === member.workspace.ownerId) {
        throw new ApiError(400, 'Cannot remove the workspace owner');
    }

    await prisma.workspaceMember.delete({ where: { id: memberId } });

    return apiSuccess({ deleted: true });
});
