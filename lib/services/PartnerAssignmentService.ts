/**
 * PartnerAssignmentService — Partner workspace assignment state machine.
 *
 * Responsibilities:
 *  - getAssignments: list all assignments for the authenticated partner
 *  - acceptAssignment: PENDING → ACCEPTED transition
 *  - rejectAssignment: PENDING → REJECTED transition (slot restored atomically)
 *  - completeAssignment: ACCEPTED|ACTIVE → COMPLETED transition (slot restored atomically)
 *
 * Note: partner CRUD/directory lives in PartnerService,
 * exams in PartnerExamService, earnings/Stripe in PartnerEarningsService.
 */
import { prisma } from '@/lib/db';

/** Resolve the partner record for the signed-in user, throwing 404 if not found. */
async function getPartnerForUser(userEmail: string) {
    const dbUser = await prisma.user.findUnique({
        where: { email: userEmail },
        include: { partnerProfile: true },
    });
    if (!dbUser || !dbUser.partnerProfile) {
        throw Object.assign(new Error('Partner profile not found'), { statusCode: 404 });
    }
    return dbUser.partnerProfile;
}

export class PartnerAssignmentService {
    /**
     * List all workspace assignments for the authenticated partner, newest first.
     */
    static async getAssignments(userEmail: string) {
        const partner = await getPartnerForUser(userEmail);
        return prisma.partnerAssignment.findMany({
            where: { partnerId: partner.id },
            include: { workspace: { select: { id: true, name: true, slug: true, logo: true } } },
            orderBy: { assignedAt: 'desc' },
        });
    }

    /**
     * Accept a pending assignment.
     */
    static async acceptAssignment(userEmail: string, assignmentId: string) {
        const partner = await getPartnerForUser(userEmail);
        const assignment = await prisma.partnerAssignment.findUnique({ where: { id: assignmentId } });
        if (!assignment) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
        if (assignment.partnerId !== partner.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
        if (assignment.status !== 'PENDING') throw Object.assign(new Error('Can only accept pending assignments'), { statusCode: 400 });

        return prisma.partnerAssignment.update({
            where: { id: assignmentId },
            data: { status: 'ACCEPTED', acceptedAt: new Date() },
        });
    }

    /**
     * Reject a pending assignment.
     * Available slot is restored atomically in a transaction.
     */
    static async rejectAssignment(userEmail: string, assignmentId: string) {
        const partner = await getPartnerForUser(userEmail);
        const assignment = await prisma.partnerAssignment.findUnique({ where: { id: assignmentId } });
        if (!assignment) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
        if (assignment.partnerId !== partner.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
        if (assignment.status !== 'PENDING') throw Object.assign(new Error('Can only reject pending assignments'), { statusCode: 400 });

        const [updated] = await prisma.$transaction([
            prisma.partnerAssignment.update({ where: { id: assignmentId }, data: { status: 'REJECTED' } }),
            prisma.partner.update({ where: { id: partner.id }, data: { availableSlots: { increment: 1 } } }),
        ]);
        return updated;
    }

    /**
     * Complete an accepted or active assignment.
     * Available slot is restored atomically in a transaction.
     */
    static async completeAssignment(userEmail: string, assignmentId: string) {
        const partner = await getPartnerForUser(userEmail);
        const assignment = await prisma.partnerAssignment.findUnique({ where: { id: assignmentId } });
        if (!assignment) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
        if (assignment.partnerId !== partner.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
        if (assignment.status === 'COMPLETED') throw Object.assign(new Error('Assignment is already completed'), { statusCode: 409 });
        if (assignment.status !== 'ACCEPTED' && assignment.status !== 'ACTIVE') {
            throw Object.assign(new Error('Can only complete ACCEPTED or ACTIVE assignments'), { statusCode: 400 });
        }

        const [updated] = await prisma.$transaction([
            prisma.partnerAssignment.update({ where: { id: assignmentId }, data: { status: 'COMPLETED', completedAt: new Date() } }),
            prisma.partner.update({ where: { id: partner.id }, data: { availableSlots: { increment: 1 } } }),
        ]);
        return updated;
    }
}
