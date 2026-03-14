import { apiSuccess } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withAuth';
import { NextRequest } from 'next/server';
import { AccountService } from '@/lib/services/AccountService';

type RouteContext = { params: Promise<{ token: string }> };

/**
 * GET /api/invitations/[token] — Verify and retrieve invitation details
 * Used by the invitation page to show invitation info before accept.
 */
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { token } = await params;
    const invitation = await AccountService.verifyInvitation(token);
    return apiSuccess({ invitation });
});
