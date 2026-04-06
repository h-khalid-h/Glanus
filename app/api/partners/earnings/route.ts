import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler, runWithUserRLS } from '@/lib/api/withAuth';
import { PartnerEarningsService } from '@/lib/services/PartnerEarningsService';

// GET /api/partners/earnings
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    return runWithUserRLS(user, async () => {
        const result = await PartnerEarningsService.getEarnings(user.email!);
        return apiSuccess(result);
    });
});
