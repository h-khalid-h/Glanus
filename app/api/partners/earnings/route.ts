import { apiSuccess, apiError } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerEarningsService } from '@/lib/services/PartnerEarningsService';

// GET /api/partners/earnings
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    try {
        const result = await PartnerEarningsService.getEarnings(user.email!);
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
