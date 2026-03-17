import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/withAuth';
import { PartnerService } from '@/lib/services/PartnerService';

// GET /api/partners/[id] - Get public partner profile (includes rating breakdown)
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;

    const partner = await PartnerService.getPartnerById(params.id);

    if (partner.status !== 'ACTIVE') {
        return apiError(404, 'Partner profile not available');
    }

    const ratings = partner.assignments
        .map((a: { rating: number | null }) => a.rating)
        .filter((r: number | null): r is number => r !== null);

    const ratingBreakdown = {
        5: ratings.filter((r: number) => r === 5).length,
        4: ratings.filter((r: number) => r === 4).length,
        3: ratings.filter((r: number) => r === 3).length,
        2: ratings.filter((r: number) => r === 2).length,
        1: ratings.filter((r: number) => r === 1).length,
    };

    return apiSuccess({ partner, ratingBreakdown });
});
