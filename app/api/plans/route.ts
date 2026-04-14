import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { prisma } from '@/lib/db';

/**
 * GET /api/plans
 *
 * Public endpoint — returns active plan configs for the pricing/billing UI.
 * No authentication required (plans are public info).
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const plans = await prisma.planConfig.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
            plan: true,
            name: true,
            description: true,
            highlighted: true,
            stripePriceIdPublic: true,
            priceMonthly: true,
            priceYearly: true,
            currency: true,
            maxAssets: true,
            maxAICreditsPerMonth: true,
            maxStorageMB: true,
            maxMembers: true,
            features: true,
        },
    });

    return apiSuccess(plans);
});
