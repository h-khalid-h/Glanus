import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAdmin, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { PartnerModerationService } from '@/lib/services/PartnerModerationService';

const updatePartnerSchema = z.object({
    action: z.enum(['verify', 'activate', 'suspend', 'ban', 'unsuspend']),
    reason: z.string().max(500).optional(),
});

// PATCH /api/admin/partners/[id]
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAdmin();
    const data = updatePartnerSchema.parse(await request.json());
    return runWithUserRLS(user, async () => {
        const result = await PartnerModerationService.moderatePartner(id, data.action, user.email!, data.reason);
        return apiSuccess(result);
    });
});
