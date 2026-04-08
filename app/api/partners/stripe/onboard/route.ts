import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler, runWithUserRLS } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { PartnerEarningsService } from '@/lib/services/PartnerEarningsService';

// POST /api/partners/stripe/onboard - Initiate Stripe Connect Express onboarding
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();
    return runWithUserRLS(user, async () => {
        const result = await PartnerEarningsService.onboardStripe(user.email!);
        return apiSuccess(result);
    });
});
