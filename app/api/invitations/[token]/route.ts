import { apiSuccess } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withAuth';
import { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/security/rateLimit';
import { InvitationService } from '@/lib/services/InvitationService';

type RouteContext = { params: Promise<{ token: string }> };

/**
 * GET /api/invitations/[token] — Verify and retrieve invitation details
 * Used by the invitation page to show invitation info before accept.
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimitResponse = await withRateLimit(request, 'api');
    if (rateLimitResponse) return rateLimitResponse;

    const { token } = await params;
    const invitation = await InvitationService.verifyInvitation(token);
    return apiSuccess({ invitation });
});
