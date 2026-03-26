import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAdmin, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerModerationService } from '@/lib/services/PartnerModerationService';
import { withRateLimit } from '@/lib/security/rateLimit';

// GET /api/admin/partners
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const result = await PartnerModerationService.listPartners({
        status: searchParams.get('status') || undefined,
        page: parseInt(searchParams.get('page') || '1', 10) || 1,
        limit: Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 200),
    });
    return apiSuccess(result);
});
