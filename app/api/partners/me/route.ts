import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';
import { PartnerService } from '@/lib/services/PartnerService';

const updatePartnerSchema = z.object({
    bio: z.string().max(1000).optional(),
    logo: z.string().url().optional().nullable(),
    coverImage: z.string().url().optional().nullable(),
    website: z.string().url().optional().nullable(),
    phone: z.string().min(10).max(20).optional(),
    serviceRadius: z.number().int().min(0).max(500).optional(),
    remoteOnly: z.boolean().optional(),
    industries: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    acceptingNew: z.boolean().optional(),
});

// GET /api/partners/me
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const partner = await PartnerService.getMyProfile(user.email!);
    return apiSuccess({ partner });
});

// PATCH /api/partners/me
export const PATCH = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const validation = updatePartnerSchema.parse(await request.json());
    const partner = await PartnerService.updateMyProfile(user.email!, validation);
    return apiSuccess({ partner });
});
