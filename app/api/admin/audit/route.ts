import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { SuperAdminService } from '@/lib/services/SuperAdminService';

/**
 * GET /api/admin/audit?page=1&limit=20
 *
 * Paginated platform-wide audit log. Requires staff role.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireStaff();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    return runWithUserRLS(user, async () => {
        const result = await SuperAdminService.getAuditLogsPaginated(page, limit);
        return apiSuccess(result);
    });
});
