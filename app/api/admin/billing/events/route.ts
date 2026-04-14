import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAdmin, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { BillingService } from '@/lib/services/BillingService';

/**
 * GET /api/admin/billing/events?page=1&limit=30&type=plan_change&workspaceId=xxx
 *
 * Returns paginated billing event timeline. Requires UserRole.ADMIN.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const type = searchParams.get('type') || undefined;
    const workspaceId = searchParams.get('workspaceId') || undefined;

    return runWithUserRLS(user, async () => {
        const result = await BillingService.getBillingEvents(page, limit, { type, workspaceId });
        return apiSuccess(result, { page, limit });
    });
});
