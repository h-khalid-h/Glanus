import { apiSuccess } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withAuth';
import { AccountService } from '@/lib/services/AccountService';
import { withRateLimit } from '@/lib/security/rateLimit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiError } from '@/lib/api/response';

type RouteContext = { params: Promise<{ token: string }> };

// POST /api/invitations/[token]/accept - Accept workspace invitation
export const POST = withErrorHandler(async (
    request: Request,
    context: RouteContext,
) => {
    // Rate limit to prevent brute-force token enumeration
    const rateLimitResponse = await withRateLimit(request as unknown as import('next/server').NextRequest, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return apiError(401, 'You must be signed in to accept an invitation');

    const { token } = await context.params;
    const result = await AccountService.acceptInvitation(token, session.user.email);
    return apiSuccess(result);
});
