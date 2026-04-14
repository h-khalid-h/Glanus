import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { BillingService } from '@/lib/services/BillingService';
import { z } from 'zod';
import type { SubscriptionPlan } from '@prisma/client';

const VALID_PLANS: SubscriptionPlan[] = ['FREE', 'PERSONAL', 'TEAM', 'ENTERPRISE'];

const updatePlanSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(500).optional(),
    highlighted: z.boolean().optional(),
    stripePriceId: z.string().max(200).optional(),
    stripePriceIdPublic: z.string().max(200).optional(),
    priceMonthly: z.number().int().min(0).optional(),
    priceYearly: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    maxAssets: z.number().int().min(0).optional(),
    maxAICreditsPerMonth: z.number().int().min(0).optional(),
    maxStorageMB: z.number().int().min(0).optional(),
    maxMembers: z.number().int().min(0).optional(),
    features: z.array(z.string().max(200)).max(20).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
});

/**
 * GET /api/admin/billing/plans
 *
 * Returns all plan configurations. Requires UserRole.ADMIN.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireStaff();

    return runWithUserRLS(user, async () => {
        const configs = await BillingService.getPlanConfigs();
        return apiSuccess(configs);
    });
});

/**
 * PUT /api/admin/billing/plans
 *
 * Update a plan configuration. Body: { plan: "PERSONAL", ...fields }
 * Requires UserRole.ADMIN.
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireStaff();
    const body = await request.json();
    const { plan, ...input } = body;

    if (!plan || !VALID_PLANS.includes(plan)) {
        const { apiError } = await import('@/lib/api/response');
        return apiError(400, 'Invalid plan. Must be one of: FREE, PERSONAL, TEAM, ENTERPRISE');
    }

    const validated = updatePlanSchema.parse(input);

    return runWithUserRLS(user, async () => {
        const config = await BillingService.updatePlanConfig(plan, validated, user.id);
        return apiSuccess(config);
    });
});
