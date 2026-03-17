import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/db';

export type PartnerAdminAction = 'verify' | 'activate' | 'suspend' | 'ban' | 'unsuspend';

/**
 * PartnerModerationService — Domain layer for admin-side partner management.
 *
 * Encapsulates:
 *   - Partner listing with pagination and status stats
 *   - Partner moderation state machine (verify → activate → suspend/ban/unsuspend)
 *     Ban cascades rejection to all PENDING/ACCEPTED assignments.
 */
export class PartnerModerationService {

    static async listPartners(query: { status?: string; page?: number; limit?: number }) {
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 20, 100);
        const skip = (page - 1) * limit;
        const where: Record<string, unknown> = {};
        if (query.status) where.status = query.status;

        const [partners, total, stats] = await Promise.all([
            prisma.partner.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true, createdAt: true } },
                    assignments: { select: { status: true, workspace: { select: { name: true } } } },
                    _count: { select: { assignments: true, examsCompleted: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.partner.count({ where }),
            prisma.partner.groupBy({ by: ['status'], _count: true }),
        ]);

        return {
            partners,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            stats: stats.reduce((acc: Record<string, number>, s) => { acc[s.status] = s._count; return acc; }, {}),
        };
    }

    /**
     * Moderation state machine: verify → activate → suspend/ban/unsuspend.
     * Ban cascades rejection to all PENDING and ACCEPTED assignments.
     */
    static async moderatePartner(id: string, action: PartnerAdminAction, adminEmail: string, reason?: string) {
        const partner = await prisma.partner.findUnique({ where: { id } });
        if (!partner) throw new ApiError(404, 'Partner not found');

        const statusMap: Record<PartnerAdminAction, string> = {
            verify: 'VERIFIED',
            activate: 'ACTIVE',
            suspend: 'SUSPENDED',
            ban: 'BANNED',
            unsuspend: 'ACTIVE',
        };

        const gates: Partial<Record<PartnerAdminAction, () => void>> = {
            verify: () => { if (partner.status !== 'PENDING') throw new ApiError(400, 'Can only verify pending partners'); },
            activate: () => { if (!['VERIFIED', 'SUSPENDED'].includes(partner.status)) throw new ApiError(400, 'Can only activate verified or suspended partners'); },
            suspend: () => { if (partner.status === 'BANNED') throw new ApiError(400, 'Cannot suspend banned partner'); },
            unsuspend: () => { if (partner.status !== 'SUSPENDED') throw new ApiError(400, 'Can only unsuspend suspended partners'); },
        };
        gates[action]?.();

        const updateData: Record<string, unknown> = { status: statusMap[action], verifiedBy: adminEmail };
        if (action === 'verify') updateData.verifiedAt = new Date();
        if (['activate', 'unsuspend'].includes(action)) updateData.acceptingNew = true;
        if (['suspend', 'ban'].includes(action)) updateData.acceptingNew = false;

        if (action === 'ban') {
            await prisma.partnerAssignment.updateMany({
                where: { partnerId: id, status: { in: ['PENDING', 'ACCEPTED'] } },
                data: { status: 'REJECTED', review: reason || 'Partner account banned by admin' },
            });
        }

        const updated = await prisma.partner.update({ where: { id }, data: updateData });
        return { partner: updated, message: `Partner ${action}d successfully` };
    }
}
