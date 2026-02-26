import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withErrorHandler } from '@/lib/api/withAuth';

// GET /api/partners - Browse public partner directory
export const GET = withErrorHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);

    // Filters
    const certificationLevel = searchParams.get('level'); // BRONZE, SILVER, GOLD, PLATINUM
    const city = searchParams.get('city');
    const region = searchParams.get('region');
    const country = searchParams.get('country') || 'US';
    const remoteOnly = searchParams.get('remoteOnly') === 'true';
    const searchQuery = searchParams.get('q'); // Search in company name, bio

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma dynamic where
        status: 'ACTIVE',
        acceptingNew: true,
    };

    if (certificationLevel) {
        where.certificationLevel = certificationLevel;
    }

    if (city) {
        where.city = { contains: city, mode: 'insensitive' };
    }

    if (region) {
        where.region = { contains: region, mode: 'insensitive' };
    }

    where.country = country;

    if (remoteOnly) {
        where.remoteOnly = true;
    }

    if (searchQuery) {
        where.OR = [
            { companyName: { contains: searchQuery, mode: 'insensitive' } },
            { bio: { contains: searchQuery, mode: 'insensitive' } },
        ];
    }

    // Get partners
    const [partners, total] = await Promise.all([
        prisma.partner.findMany({
            where,
            select: {
                id: true,
                companyName: true,
                bio: true,
                logo: true,
                coverImage: true,
                certificationLevel: true,
                city: true,
                region: true,
                country: true,
                serviceRadius: true,
                remoteOnly: true,
                industries: true,
                certifications: true,
                languages: true,
                averageRating: true,
                totalReviews: true,
                maxWorkspaces: true,
                availableSlots: true,
                certifiedAt: true,
            },
            orderBy: [
                { averageRating: 'desc' },
                { certificationLevel: 'desc' },
                { totalReviews: 'desc' },
            ],
            skip,
            take: limit,
        }),
        prisma.partner.count({ where }),
    ]);

    return apiSuccess({
        partners,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
});
