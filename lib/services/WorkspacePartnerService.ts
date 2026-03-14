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
        if (!workspace) throw Object.assign(new Error('Workspace not found'), { statusCode: 404 });
        if (!workspace.partnerAssignment) throw Object.assign(new Error('No partner assigned to this workspace'), { statusCode: 404 });

        const assignment = workspace.partnerAssignment;
        if (assignment.status === 'COMPLETED') {
            throw Object.assign(new Error('Cannot remove completed partner assignments (kept for records)'), { statusCode: 400 });
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
            throw Object.assign(new Error('No partner assigned to this workspace'), { statusCode: 404 });
        }

        const assignment = workspace.partnerAssignment;
        if (assignment.rating) {
            throw Object.assign(new Error('Partner already reviewed. Contact support to update review.'), { statusCode: 409 });
        }
        if (assignment.status !== 'COMPLETED') {
            throw Object.assign(new Error('Can only review completed assignments'), { statusCode: 400 });
        }

        const updated = await prisma.partnerAssignment.update({
            where: { id: assignment.id },
            data: { rating: data.rating, review: sanitizeText(data.review), ratedAt: new Date() },
        });

        const allRatings = await prisma.partnerAssignment.findMany({
            where: { partnerId: assignment.partnerId, rating: { not: null } },
            select: { rating: true },
        });
        const totalRatings = allRatings.length;
        const averageRating = allRatings.reduce((sum: number, r) => sum + (r.rating || 0), 0) / totalRatings;

        await prisma.partner.update({
            where: { id: assignment.partnerId },
            data: { averageRating, totalReviews: totalRatings },
        });

        return { assignment: updated, message: 'Review submitted successfully. Thank you for your feedback!' };
    }

    static async assignPartner(workspaceId: string) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { partnerAssignment: true },
        });
        if (!workspace) throw Object.assign(new Error('Workspace not found'), { statusCode: 404 });
        if (workspace.partnerAssignment) throw Object.assign(new Error('Workspace already has a partner assigned'), { statusCode: 409 });

        const eligiblePartners = await prisma.partner.findMany({
            where: getPartnerEligibilityCriteria(),
            include: { assignments: { where: { status: { in: ['ACCEPTED', 'ACTIVE'] } } } },
        });
        if (eligiblePartners.length === 0) {
            throw Object.assign(new Error('No partners available at this time. Please try again later.'), { statusCode: 404 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bestMatch = await findBestPartner(workspace as unknown as Parameters<typeof findBestPartner>[0], eligiblePartners as any);
        if (!bestMatch) {
            throw Object.assign(new Error('No suitable partner found for your workspace.'), { statusCode: 404 });
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
