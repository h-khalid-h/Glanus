import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { InvitationService } from '@/lib/services/InvitationService';

type RouteContext = { params: Promise<{ id: string; invId: string }> };

function getRequestContext(request: NextRequest) {
    return {
        ipAddress:
            request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
            request.headers.get('x-real-ip') ||
            undefined,
        userAgent: request.headers.get('user-agent') || undefined,
    };
}

/**
 * DELETE /api/workspaces/[id]/invitations/[invId]
 * Revoke (cancel) a pending invitation by its database ID.
 * Marks status as REVOKED — does NOT delete the record (audit trail preserved).
 * Requires ADMIN or OWNER role.
 */
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, invId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const result = await InvitationService.revokeInvitation(
        workspaceId,
        invId,
        user.id,
        getRequestContext(request),
    );
    return apiSuccess(result);
});
