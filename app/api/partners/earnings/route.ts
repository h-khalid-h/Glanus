import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerEarningsService } from '@/lib/services/PartnerEarningsService';

// GET /api/partners/earnings
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    const result = await PartnerEarningsService.getEarnings(user.email!);
    return apiSuccess(result);
});
