import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerEarningsService } from '@/lib/services/PartnerEarningsService';

// POST /api/partners/stripe/onboard - Initiate Stripe Connect Express onboarding
export const POST = withErrorHandler(async () => {
    const user = await requireAuth();
    const result = await PartnerEarningsService.onboardStripe(user.email!);
    return apiSuccess(result);
});
