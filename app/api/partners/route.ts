import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/withAuth';
import { PartnerService } from '@/lib/services/PartnerService';

// GET /api/partners - Browse public partner directory
export const GET = withErrorHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);

    try {
        const result = await PartnerService.getPartners({
            certificationLevel: searchParams.get('level') || undefined,
            city: searchParams.get('city') || undefined,
            region: searchParams.get('region') || undefined,
            country: searchParams.get('country') || 'US',
            remoteOnly: searchParams.get('remoteOnly') === 'true',
            searchQuery: searchParams.get('q') || undefined,
            page: parseInt(searchParams.get('page') || '1'),
            limit: parseInt(searchParams.get('limit') || '20'),
        });
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
