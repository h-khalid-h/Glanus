/**
 * PartnerService — Public-facing partner directory and profile management.
 *
 * Responsibilities:
 *  - getPartners: paginated partner directory with specialty / tier / location filters
 *  - getPartnerById: fetch a single partner's public profile with recent ratings
 *  - getMyProfile: authenticated partner's self-view (includes assignments, exams, payouts)
 *  - updateMyProfile: patch profile fields (bio, logo, services, languages, etc.)
 *  - applyAsPartner: partner program application with sanitization + duplicate guard
 *
 * Extracted to sibling services:
 *  - PartnerExamService         → startExam / submitExam / getExamHistory
 *  - PartnerAssignmentService   → getAssignments / acceptAssignment / rejectAssignment / completeAssignment
 *  - PartnerEarningsService     → getEarnings / getPayouts / onboardStripe
 */
import { prisma } from '@/lib/db';
import { sanitizeText } from '@/lib/security/sanitize';

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

}
