import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { SuperAdminService } from '@/lib/services/SuperAdminService';

/**
 * GET /api/admin/analytics?days=30
 *
 * Returns cross-tenant usage analytics:
 *  - activityByDay  : audit log events per workspace per day
 *  - workspaceUsage : per-workspace asset / user / agent / event counts
 *  - topByAssets    : top 10 workspaces by asset count
 *  - topByActivity  : top 10 workspaces by audit event volume
 *
 * Requires UserRole.ADMIN.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireStaff();

    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10)));

    return runWithUserRLS(user, async () => {
        const analytics = await SuperAdminService.getUsageAnalytics(days);
        return apiSuccess({ analytics, meta: { days } });
    });
});
