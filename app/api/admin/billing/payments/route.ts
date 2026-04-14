import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAdmin, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { BillingService } from '@/lib/services/BillingService';

/**
 * GET /api/admin/billing/payments?page=1&limit=20&status=SUCCEEDED&workspaceId=xxx
 *
 * Returns paginated payment history. Requires UserRole.ADMIN.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status') || undefined;
    const workspaceId = searchParams.get('workspaceId') || undefined;

    return runWithUserRLS(user, async () => {
        const result = await BillingService.getPayments(page, limit, { status, workspaceId });
        return apiSuccess(result, { page, limit });
    });
});
