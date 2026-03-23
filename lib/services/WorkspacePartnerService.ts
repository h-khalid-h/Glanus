import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { sanitizeText } from '@/lib/security/sanitize';
import {
    findBestPartner,
    getPartnerEligibilityCriteria,
} from '@/lib/partners/assignment';

/**
 * WorkspacePartnerService — Partner relationship management for a workspace.
 *
 * Responsibilities:
 *  - removePartner: detach the assigned partner, incrementing their available slot
 *  - reviewPartner: submit a star-rating + review for a completed assignment
 *  - assignPartner: match-make and assign the best eligible partner
 */
export class WorkspacePartnerService {
    static async removePartner(workspaceId: string, _userEmail: string) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { partnerAssignment: true },
        });
        if (!workspace) throw new ApiError(404, 'Workspace not found');
        if (!workspace.partnerAssignment) throw new ApiError(404, 'No partner assigned to this workspace');

        const assignment = workspace.partnerAssignment;
        if (assignment.status === 'COMPLETED') {
            throw new ApiError(400, 'Cannot remove completed partner assignments (kept for records)');
        }

        await prisma.$transaction(async (tx) => {
            if (assignment.status === 'ACCEPTED' || assignment.status === 'ACTIVE') {
                await tx.partner.update({
                    where: { id: assignment.partnerId },
                    data: { availableSlots: { increment: 1 } },
                });
            }
            await tx.partnerAssignment.delete({ where: { id: assignment.id } });
        });

        return { message: 'Partner removed successfully' };
    }

    static async reviewPartner(
        workspaceId: string,
        data: { rating: number; review: string },
    ) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { partnerAssignment: true },
        });
        if (!workspace || !workspace.partnerAssignment) {
            throw new ApiError(404, 'No partner assigned to this workspace');
        }

        const assignment = workspace.partnerAssignment;
        if (assignment.rating) {
            throw new ApiError(409, 'Partner already reviewed. Contact support to update review.');
        }
        if (assignment.status !== 'COMPLETED') {
            throw new ApiError(400, 'Can only review completed assignments');
        }

        const updated = await prisma.$transaction(async (tx) => {
            const txAssignment = await tx.partnerAssignment.update({
                where: { id: assignment.id },
                data: { rating: data.rating, review: sanitizeText(data.review), ratedAt: new Date() },
            });

            const allRatings = await tx.partnerAssignment.findMany({
                where: { partnerId: assignment.partnerId, rating: { not: null } },
                select: { rating: true },
            });
            const totalRatings = allRatings.length;
            const averageRating = totalRatings > 0
                ? allRatings.reduce((sum: number, r) => sum + (r.rating || 0), 0) / totalRatings
                : data.rating;

            await tx.partner.update({
                where: { id: assignment.partnerId },
                data: { averageRating, totalReviews: totalRatings },
            });

            return txAssignment;
        });

        return { assignment: updated, message: 'Review submitted successfully. Thank you for your feedback!' };
    }

    static async assignPartner(workspaceId: string) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { partnerAssignment: true },
        });
        if (!workspace) throw new ApiError(404, 'Workspace not found');
        if (workspace.partnerAssignment) throw new ApiError(409, 'Workspace already has a partner assigned');

        const eligiblePartners = await prisma.partner.findMany({
            where: getPartnerEligibilityCriteria(),
            include: { assignments: { where: { status: { in: ['ACCEPTED', 'ACTIVE'] } } } },
        });
        if (eligiblePartners.length === 0) {
            throw new ApiError(404, 'No partners available at this time. Please try again later.');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bestMatch = await findBestPartner(workspace as unknown as Parameters<typeof findBestPartner>[0], eligiblePartners as any);
        if (!bestMatch) {
            throw new ApiError(404, 'No suitable partner found for your workspace.');
        }

        const partnerId = (bestMatch.partner as unknown as { id: string }).id;

        const [assignment] = await prisma.$transaction([
            prisma.partnerAssignment.create({
                data: { partnerId, workspaceId, status: 'PENDING', revenueSplit: 0.5 },
                include: {
                    partner: {
                        select: {
                            id: true, companyName: true, bio: true, logo: true,
                            certificationLevel: true, averageRating: true, totalReviews: true,
                        },
                    },
                },
            }),
            prisma.partner.update({ where: { id: partnerId }, data: { availableSlots: { decrement: 1 } } }),
        ]);

        return {
            assignment,
            matchScore: Math.round(bestMatch.score),
            matchBreakdown: bestMatch.breakdown,
            message: 'Partner assigned successfully! They will be notified and can accept or decline.',
        };
    }
}
