import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { SuperAdminService } from '@/lib/services/SuperAdminService';

/**
 * GET /api/admin/dashboard
 *
 * Returns platform-wide KPIs, recent cross-tenant audit activity, and
 * platform-level alerts. Requires UserRole.ADMIN.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireStaff();

    return runWithUserRLS(user, async () => {
        const [kpis, recentActivity, alerts] = await Promise.all([
            SuperAdminService.getPlatformKPIs(),
            SuperAdminService.getRecentActivity(20),
            SuperAdminService.getPlatformAlerts(),
        ]);

        return apiSuccess({ kpis, recentActivity, alerts });
    });
});
