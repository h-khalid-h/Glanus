import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';

const updatePartnerSchema = z.object({
    action: z.enum(['verify', 'activate', 'suspend', 'ban', 'unsuspend']),
    reason: z.string().max(500).optional(),
});

// PATCH /api/admin/partners/[id] - Verify, suspend, or ban partner
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAdmin();

    // Validate request
    const body = await request.json();
    const validation = updatePartnerSchema.safeParse(body);

    if (!validation.success) {
        return apiError(400, 'Validation failed', validation.error.errors);
    }

    const { action, reason } = validation.data;

    // Get partner
    const partner = await prisma.partner.findUnique({
        where: { id },
    });

    if (!partner) {
        return apiError(404, 'Partner not found');
    }

    // Perform action
    const updateData: any = {
        verifiedBy: user.email,
    };

    switch (action) {
        case 'verify':
            if (partner.status !== 'PENDING') {
                return apiError(400, 'Can only verify pending partners');
            }
            updateData.status = 'VERIFIED';
            updateData.verifiedAt = new Date();
            break;

        case 'activate':
            if (partner.status !== 'VERIFIED' && partner.status !== 'SUSPENDED') {
                return apiError(400, 'Can only activate verified or suspended partners');
            }
            updateData.status = 'ACTIVE';
            updateData.acceptingNew = true;
            break;

        case 'suspend':
            if (partner.status === 'BANNED') {
                return apiError(400, 'Cannot suspend banned partner');
            }
            updateData.status = 'SUSPENDED';
            updateData.acceptingNew = false;
            break;

        case 'ban':
            updateData.status = 'BANNED';
            updateData.acceptingNew = false;
            // Cancel all pending/accepted assignments
            await prisma.partnerAssignment.updateMany({
                where: {
                    partnerId: partner.id,
                    status: { in: ['PENDING', 'ACCEPTED'] },
                },
                data: {
                    status: 'REJECTED',
                    review: reason || 'Partner account banned by admin',
                },
            });
            break;

        case 'unsuspend':
            if (partner.status !== 'SUSPENDED') {
                return apiError(400, 'Can only unsuspend suspended partners');
            }
            updateData.status = 'ACTIVE';
            updateData.acceptingNew = true;
            break;
    }

    // Update partner
    const updated = await prisma.partner.update({
        where: { id },
        data: updateData,
    });

    return apiSuccess({
        partner: updated,
        message: `Partner ${action}d successfully`,
    });
});
