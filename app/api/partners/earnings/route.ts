import { apiSuccess, apiError } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerService } from '@/lib/services/PartnerService';

// GET /api/partners/earnings
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    try {
        const result = await PartnerService.getEarnings(user.email!);
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
