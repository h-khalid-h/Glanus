import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler, runWithUserRLS } from '@/lib/api/withAuth';
import { PartnerEarningsService } from '@/lib/services/PartnerEarningsService';

// POST /api/partners/stripe/onboard - Initiate Stripe Connect Express onboarding
export const POST = withErrorHandler(async () => {
    const user = await requireAuth();
    return runWithUserRLS(user, async () => {
        const result = await PartnerEarningsService.onboardStripe(user.email!);
        return apiSuccess(result);
    });
});
