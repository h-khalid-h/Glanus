import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAdmin, withErrorHandler } from '@/lib/api/withAuth';
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
    const body = await request.json();
    const validation = updatePartnerSchema.safeParse(body);
    if (!validation.success) return apiError(400, 'Validation failed', validation.error.errors);

    try {
        const result = await PartnerModerationService.moderatePartner(id, validation.data.action, user.email!, validation.data.reason);
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
