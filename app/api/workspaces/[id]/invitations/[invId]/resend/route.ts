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
 * POST /api/workspaces/[id]/invitations/[invId]/resend
 * Resend an invitation: expires the old token and issues a fresh 48-hour token.
 * Works for PENDING and EXPIRED invitations.
 * Requires ADMIN or OWNER role.
 */
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, invId } = await params;
    const user = await requireAuth();
    const { workspace } = await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const result = await InvitationService.resendInvitation(
        workspaceId,
        invId,
        user.id,
        workspace.name,
        getRequestContext(request),
    );
    return apiSuccess(result);
});
