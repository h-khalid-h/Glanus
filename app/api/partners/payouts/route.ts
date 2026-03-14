import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerService } from '@/lib/services/PartnerService';

// GET /api/partners/payouts - Get payout history
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    const result = await PartnerService.getPayouts(user.email!);
    return apiSuccess(result);
});
