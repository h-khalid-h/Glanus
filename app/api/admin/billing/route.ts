import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAdmin, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { BillingService } from '@/lib/services/BillingService';

/**
 * GET /api/admin/billing
 *
 * Returns revenue metrics, plan distribution, and monthly revenue trends.
 * Requires UserRole.ADMIN.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAdmin();

    return runWithUserRLS(user, async () => {
        const metrics = await BillingService.getRevenueMetrics();
        return apiSuccess(metrics);
    });
});
