import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAdmin, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { BillingService } from '@/lib/services/BillingService';
import { z } from 'zod';


const overrideSchema = z.object({
    workspaceId: z.string().min(1),
    plan: z.enum(['FREE', 'PERSONAL', 'TEAM', 'ENTERPRISE']),
    reason: z.string().max(500).optional(),
});

/**
 * POST /api/admin/billing/override
 *
 * Manually override a workspace's subscription plan.
 * Body: { workspaceId, plan, reason? }
 * Requires UserRole.ADMIN.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAdmin();
    const body = await request.json();
    const { workspaceId, plan, reason } = overrideSchema.parse(body);

    return runWithUserRLS(user, async () => {
        await BillingService.overrideWorkspacePlan(workspaceId, plan, user.id, reason);
        return apiSuccess({ success: true, workspaceId, plan });
    });
});
