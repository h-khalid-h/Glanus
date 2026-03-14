import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAdmin, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerModerationService } from '@/lib/services/PartnerModerationService';

// GET /api/admin/partners
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const result = await PartnerModerationService.listPartners({
        status: searchParams.get('status') || undefined,
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '20'),
    });
    return apiSuccess(result);
});
