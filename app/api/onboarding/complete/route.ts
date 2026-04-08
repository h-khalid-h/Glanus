import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { AccountService } from '@/lib/services/AccountService';
import { withRateLimit } from '@/lib/security/rateLimit';

// POST /api/onboarding/complete - Mark user's onboarding as complete
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();
    return runWithUserRLS(user, async () => {
        const result = await AccountService.completeOnboarding(user.id);
        return apiSuccess(result);
    });
});
