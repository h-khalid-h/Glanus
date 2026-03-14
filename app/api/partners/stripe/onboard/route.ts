import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerService } from '@/lib/services/PartnerService';

// POST /api/partners/stripe/onboard - Initiate Stripe Connect Express onboarding
export const POST = withErrorHandler(async () => {
    const user = await requireAuth();
    const result = await PartnerService.onboardStripe(user.email!);
    return apiSuccess(result);
});
