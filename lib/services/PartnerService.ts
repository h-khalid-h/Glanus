/**
 * PartnerService — Public-facing partner directory and profile management.
 *
 * Responsibilities:
 *  - getPartners: paginated partner directory with specialty / tier filters
 *  - getPartnerById: fetch a single partner's public profile
 *  - createPartnerProfile / updatePartnerProfile: partner self-registration and editing
 */
import { prisma } from '@/lib/db';
import { sanitizeText } from '@/lib/security/sanitize';
import { stripe } from '@/lib/stripe/client';

// ============================================
// INPUT TYPES
// ============================================

export interface PartnerDirectoryFilters {
    certificationLevel?: string;
    city?: string;
    region?: string;
    country?: string;
    remoteOnly?: boolean;
    searchQuery?: string;
    page?: number;
    limit?: number;
}

export interface PartnerSignupInput {
    userId: string;
    userEmail: string;
    companyName: string;
    businessNumber?: string;
    website?: string | null;
    phone?: string;
    bio?: string;
    address?: string;
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
    serviceRadius?: number;
    remoteOnly?: boolean;
    industries?: string[];
    certifications?: string[];
    languages?: string[];
}

export interface UpdatePartnerProfileInput {
    bio?: string;
    logo?: string | null;
    coverImage?: string | null;
    website?: string | null;
    phone?: string;
    serviceRadius?: number;
    remoteOnly?: boolean;
    industries?: string[];
    certifications?: string[];
    languages?: string[];
    acceptingNew?: boolean;
}

// ============================================
// PARTNER SERVICE
// ============================================

/**
 * PartnerService — Domain layer for the full Partner Ecosystem.
 *
 * Encapsulates:
 *   - Partner directory browsing with filtering and pagination
 *   - Partner profile retrieval (public + self-view)
 *   - Partner application (signup with sanitization + duplication check)
 *   - Partner profile updates
 *   - Exam lifecycle: start (question randomization), submit (grading engine + certification upgrade)
 *   - Exam history retrieval
 *   - Assignment state machine: list, accept, reject, complete
 *   - Earnings dashboard computation
 */
export class PartnerService {

    // ========================================
    // DIRECTORY
    // ========================================

    static async getPartners(filters: PartnerDirectoryFilters) {
        const {
            certificationLevel, city, region, country = 'US',
            remoteOnly, searchQuery, page = 1, limit = 20,
        } = filters;

        const safeLimit = Math.min(limit, 50);
        const skip = (page - 1) * safeLimit;

        const where: Record<string, unknown> = { status: 'ACTIVE', acceptingNew: true, country };
        if (certificationLevel) where.certificationLevel = certificationLevel;
        if (city) where.city = { contains: city, mode: 'insensitive' };
        if (region) where.region = { contains: region, mode: 'insensitive' };
        if (remoteOnly) where.remoteOnly = true;
        if (searchQuery) {
            where.OR = [
                { companyName: { contains: searchQuery, mode: 'insensitive' } },
                { bio: { contains: searchQuery, mode: 'insensitive' } },
            ];
        }

        const [partners, total] = await Promise.all([
            prisma.partner.findMany({
                where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic Prisma where
                select: {
                    id: true, companyName: true, bio: true, logo: true, coverImage: true,
                    certificationLevel: true, city: true, region: true, country: true,
                    serviceRadius: true, remoteOnly: true, industries: true,
                    certifications: true, languages: true, averageRating: true,
                    totalReviews: true, maxWorkspaces: true, availableSlots: true, certifiedAt: true,
                },
                orderBy: [{ averageRating: 'desc' }, { certificationLevel: 'desc' }, { totalReviews: 'desc' }],
                skip,
                take: safeLimit,
            }),
            prisma.partner.count({ where: where as any }), // eslint-disable-line @typescript-eslint/no-explicit-any
        ]);

        return { partners, pagination: { page, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
    }

    static async getPartnerById(partnerId: string) {
        const partner = await prisma.partner.findUnique({
            where: { id: partnerId },
            include: {
                examsCompleted: true,
                assignments: {
                    where: { status: 'COMPLETED', rating: { not: null } },
                    select: {
                        rating: true, review: true, ratedAt: true, completedAt: true,
                        workspace: { select: { name: true, logo: true } },
                    },
                    orderBy: { ratedAt: 'desc' },
                    take: 10,
                },
                _count: { select: { assignments: true } },
            },
        });
        if (!partner) {
            throw Object.assign(new Error('Partner not found'), { statusCode: 404 });
        }
        return partner;
    }

    // ========================================
    // PROFILE (Self)
    // ========================================

    static async getMyProfile(userEmail: string) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: {
                partnerProfile: {
                    include: {
                        assignments: {
                            where: { status: { in: ['PENDING', 'ACCEPTED', 'ACTIVE'] } },
                            include: { workspace: { select: { id: true, name: true, slug: true, logo: true } } },
                        },
                        examsCompleted: true,
                        payouts: { orderBy: { createdAt: 'desc' }, take: 10 },
                        _count: { select: { assignments: true } },
                    },
                },
            },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw Object.assign(new Error('Partner profile not found'), { statusCode: 404 });
        }
        return dbUser.partnerProfile;
    }

    static async updateMyProfile(userEmail: string, updates: UpdatePartnerProfileInput) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw Object.assign(new Error('Partner profile not found'), { statusCode: 404 });
        }
        const updated = await prisma.partner.update({
            where: { id: dbUser.partnerProfile.id },
            data: updates,
        });
        return updated;
    }

    // ========================================
    // SIGNUP
    // ========================================

    static async applyAsPartner(input: PartnerSignupInput) {
        const dbUser = await prisma.user.findUnique({
            where: { email: input.userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser) {
            throw Object.assign(new Error('User not found'), { statusCode: 404 });
        }
        if (dbUser.partnerProfile) {
            throw Object.assign(new Error('You are already registered as a partner'), { statusCode: 409 });
        }

        const partner = await prisma.partner.create({
            data: {
                userId: dbUser.id,
                companyName: sanitizeText(input.companyName),
                businessNumber: input.businessNumber,
                website: input.website,
                phone: input.phone,
                bio: input.bio ? sanitizeText(input.bio) : null,
                address: input.address ? sanitizeText(input.address) : null,
                city: input.city,
                region: input.region,
                country: input.country || 'US',
                timezone: input.timezone,
                serviceRadius: input.serviceRadius,
                remoteOnly: input.remoteOnly || false,
                industries: input.industries || [],
                certifications: input.certifications || [],
                languages: input.languages || ['en'],
                status: 'PENDING',
            },
        });

        return partner;
    }

    // ========================================
    // EXAM LIFECYCLE
    // ========================================

    static async startExam(userEmail: string, level: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM') {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw Object.assign(new Error('Partner profile not found'), { statusCode: 404 });
        }
        const partner = dbUser.partnerProfile;

        if (partner.status !== 'ACTIVE' && partner.status !== 'VERIFIED') {
            throw Object.assign(new Error('Partner must be verified or active to take exams'), { statusCode: 403 });
        }

        const activeExam = await prisma.partnerExam.findFirst({ where: { partnerId: partner.id, status: 'STARTED' } });
        if (activeExam) {
            throw Object.assign(new Error('You already have an exam in progress'), { statusCode: 409 });
        }

        const passedExam = await prisma.partnerExam.findFirst({ where: { partnerId: partner.id, level, status: 'PASSED' } });
        if (passedExam && partner.certificationLevel === level) {
            throw Object.assign(new Error(`You are already certified at ${level} level`), { statusCode: 409 });
        }

        const allQuestions = await prisma.examQuestion.findMany({ where: { level, isActive: true } });
        if (allQuestions.length < 20) {
            throw Object.assign(new Error(`Not enough questions for ${level} exam (need 20, have ${allQuestions.length})`), { statusCode: 500 });
        }

        const selectedQuestions = allQuestions.sort(() => Math.random() - 0.5).slice(0, 20);
        const exam = await prisma.partnerExam.create({
            data: {
                partnerId: partner.id,
                level,
                status: 'STARTED',
                questions: selectedQuestions.map(q => q.id),
                answers: {},
                score: 0,
                passingScore: 80,
                timeLimit: 60,
            },
        });

        const questionsForExam = selectedQuestions.map((q, index) => ({
            index, question: q.question, options: q.options, category: q.category, difficulty: q.difficulty,
        }));

        return {
            exam: { id: exam.id, level: exam.level, timeLimit: exam.timeLimit, passingScore: exam.passingScore, startedAt: exam.startedAt, questionCount: selectedQuestions.length },
            questions: questionsForExam,
        };
    }

    static async submitExam(userEmail: string, examId: string, answers: Record<string, number>) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw Object.assign(new Error('Partner profile not found'), { statusCode: 404 });
        }

        const exam = await prisma.partnerExam.findUnique({ where: { id: examId } });
        if (!exam) throw Object.assign(new Error('Exam not found'), { statusCode: 404 });
        if (exam.partnerId !== dbUser.partnerProfile.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
        if (exam.status !== 'STARTED') throw Object.assign(new Error('Exam already submitted'), { statusCode: 409 });

        const timeElapsed = Date.now() - exam.startedAt.getTime();
        if (timeElapsed > exam.timeLimit * 60 * 1000) {
            throw Object.assign(new Error('Exam time limit exceeded'), { statusCode: 400 });
        }

        const questionIds = exam.questions as string[];
        const questions = await prisma.examQuestion.findMany({ where: { id: { in: questionIds } } });

        let correctCount = 0;
        const results = questions.map((question, index) => {
            const userAnswer = answers[index.toString()];
            const isCorrect = userAnswer === question.correctAnswer;
            if (isCorrect) correctCount++;
            return { index, question: question.question, userAnswer, correctAnswer: question.correctAnswer, isCorrect, explanation: question.explanation };
        });

        const score = Math.round((correctCount / questions.length) * 100);
        const passed = score >= exam.passingScore;

        const updatedExam = await prisma.partnerExam.update({
            where: { id: examId },
            data: { answers: answers as object, score, status: passed ? 'PASSED' : 'FAILED', completedAt: new Date() },
        });

        let updatedPartner = dbUser.partnerProfile;
        if (passed) {
            const maxWorkspacesByLevel: Record<string, number> = { BRONZE: 10, SILVER: 50, GOLD: 200, PLATINUM: 1000 };
            const newMaxWorkspaces = maxWorkspacesByLevel[exam.level];
            updatedPartner = await prisma.partner.update({
                where: { id: dbUser.partnerProfile.id },
                data: { certificationLevel: exam.level, certifiedAt: new Date(), maxWorkspaces: newMaxWorkspaces, availableSlots: newMaxWorkspaces },
            });
        }

        return {
            exam: updatedExam,
            results: { score, passed, correctCount, totalQuestions: questions.length, passingScore: exam.passingScore },
            partner: passed ? updatedPartner : undefined,
            breakdown: results,
        };
    }

    static async getExamHistory(userEmail: string) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw Object.assign(new Error('Partner profile not found'), { statusCode: 404 });
        }
        return prisma.partnerExam.findMany({
            where: { partnerId: dbUser.partnerProfile.id },
            orderBy: { startedAt: 'desc' },
        });
    }

    // ========================================
    // ASSIGNMENT STATE MACHINE
    // ========================================

    private static async getPartnerForUser(userEmail: string) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw Object.assign(new Error('Partner profile not found'), { statusCode: 404 });
        }
        return dbUser.partnerProfile;
    }

    static async getAssignments(userEmail: string) {
        const partner = await PartnerService.getPartnerForUser(userEmail);
        return prisma.partnerAssignment.findMany({
            where: { partnerId: partner.id },
            include: { workspace: { select: { id: true, name: true, slug: true, logo: true } } },
            orderBy: { assignedAt: 'desc' },
        });
    }

    static async acceptAssignment(userEmail: string, assignmentId: string) {
        const partner = await PartnerService.getPartnerForUser(userEmail);
        const assignment = await prisma.partnerAssignment.findUnique({ where: { id: assignmentId } });
        if (!assignment) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
        if (assignment.partnerId !== partner.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
        if (assignment.status !== 'PENDING') throw Object.assign(new Error('Can only accept pending assignments'), { statusCode: 400 });

        return prisma.partnerAssignment.update({
            where: { id: assignmentId },
            data: { status: 'ACCEPTED', acceptedAt: new Date() },
        });
    }

    static async rejectAssignment(userEmail: string, assignmentId: string) {
        const partner = await PartnerService.getPartnerForUser(userEmail);
        const assignment = await prisma.partnerAssignment.findUnique({ where: { id: assignmentId } });
        if (!assignment) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
        if (assignment.partnerId !== partner.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
        if (assignment.status !== 'PENDING') throw Object.assign(new Error('Can only reject pending assignments'), { statusCode: 400 });

        // Restore slot atomically
        const [updated] = await prisma.$transaction([
            prisma.partnerAssignment.update({ where: { id: assignmentId }, data: { status: 'REJECTED' } }),
            prisma.partner.update({ where: { id: partner.id }, data: { availableSlots: { increment: 1 } } }),
        ]);
        return updated;
    }

    static async completeAssignment(userEmail: string, assignmentId: string) {
        const partner = await PartnerService.getPartnerForUser(userEmail);
        const assignment = await prisma.partnerAssignment.findUnique({ where: { id: assignmentId } });
        if (!assignment) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
        if (assignment.partnerId !== partner.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
        if (assignment.status === 'COMPLETED') throw Object.assign(new Error('Assignment is already completed'), { statusCode: 409 });
        if (assignment.status !== 'ACCEPTED' && assignment.status !== 'ACTIVE') {
            throw Object.assign(new Error('Can only complete ACCEPTED or ACTIVE assignments'), { statusCode: 400 });
        }

        // Restore slot atomically on completion
        const [updated] = await prisma.$transaction([
            prisma.partnerAssignment.update({ where: { id: assignmentId }, data: { status: 'COMPLETED', completedAt: new Date() } }),
            prisma.partner.update({ where: { id: partner.id }, data: { availableSlots: { increment: 1 } } }),
        ]);
        return updated;
    }

    // ========================================
    // EARNINGS DASHBOARD
    // ========================================

    static async getEarnings(userEmail: string) {
        const partner = await PartnerService.getPartnerForUser(userEmail);

        const assignments = await prisma.partnerAssignment.findMany({
            where: { partnerId: partner.id, status: { in: ['ACCEPTED', 'ACTIVE', 'COMPLETED'] } },
            include: {
                workspace: {
                    select: {
                        id: true, name: true, slug: true, logo: true,
                        subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
                    },
                },
            },
            orderBy: { assignedAt: 'desc' },
        });

        const planPrices: Record<string, number> = { FREE: 0, PERSONAL: 19, TEAM: 49, ENTERPRISE: 99 };
        const activeAssignments = assignments.filter(a => a.status === 'ACCEPTED' || a.status === 'ACTIVE');

        let currentMonthEstimate = 0;
        activeAssignments.forEach(a => {
            if (a.workspace.subscription?.status === 'ACTIVE') {
                const planPrice = planPrices[a.workspace.subscription.plan] || 0;
                currentMonthEstimate += planPrice * Number(a.revenueSplit);
            }
        });

        const topWorkspaces = assignments
            .sort((a, b) => Number(b.totalEarnings) - Number(a.totalEarnings))
            .slice(0, 5)
            .map(a => ({ workspace: a.workspace, totalEarnings: a.totalEarnings, status: a.status, assignedAt: a.assignedAt }));

        return {
            summary: {
                totalEarnings: partner.totalEarnings, currentMonthEstimate,
                activeWorkspaces: activeAssignments.length, totalWorkspaces: assignments.length,
                certificationLevel: partner.certificationLevel,
                maxWorkspaces: partner.maxWorkspaces, availableSlots: partner.availableSlots,
            },
            topWorkspaces, assignments, stripeConnected: partner.stripeOnboarded,
        };
    }

    // ========================================
    // PAYOUTS
    // ========================================

    static async getPayouts(userEmail: string) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw Object.assign(new Error('Partner profile not found'), { statusCode: 404 });
        }

        const payouts = await prisma.partnerPayout.findMany({
            where: { partnerId: dbUser.partnerProfile.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, amount: true, currency: true, periodStart: true, periodEnd: true,
                status: true, stripePayoutId: true, failureReason: true,
                workspaceCount: true, subscriptionDetails: true, createdAt: true, paidAt: true,
            },
        });

        const stats = {
            totalPaid: payouts.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0),
            pending: payouts.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING').reduce((sum, p) => sum + Number(p.amount), 0),
            failed: payouts.filter((p) => p.status === 'FAILED').length,
            total: payouts.length,
        };

        return { payouts, stats };
    }

    // ========================================
    // STRIPE CONNECT ONBOARDING
    // ========================================

    static async onboardStripe(userEmail: string) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw Object.assign(new Error('Partner profile not found'), { statusCode: 404 });
        }

        if (dbUser.partnerProfile.stripeOnboarded) {
            return { message: 'Stripe account already connected', stripeAccountId: dbUser.partnerProfile.stripeAccountId, alreadyOnboarded: true };
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        let stripeAccountId = dbUser.partnerProfile.stripeAccountId;

        if (!stripeAccountId) {
            const account = await stripe.accounts.create({
                type: 'express', email: dbUser.email,
                metadata: { partnerId: dbUser.partnerProfile.id, userId: dbUser.id },
                capabilities: { transfers: { requested: true } },
                business_type: 'individual',
            });
            stripeAccountId = account.id;
            await prisma.partner.update({ where: { id: dbUser.partnerProfile.id }, data: { stripeAccountId } });
        }

        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId!,
            refresh_url: `${baseUrl}/partners/earnings?stripe=refresh`,
            return_url: `${baseUrl}/partners/earnings?stripe=complete`,
            type: 'account_onboarding',
        });

        return { url: accountLink.url, stripeAccountId };
    }
}
