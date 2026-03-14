import { apiSuccess, apiError } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
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
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    try {
        const partner = await PartnerService.getMyProfile(user.email!);
        return apiSuccess({ partner });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// PATCH /api/partners/me
export const PATCH = withErrorHandler(async (request: Request) => {
    const user = await requireAuth();
    const body = await request.json();
    const validation = updatePartnerSchema.safeParse(body);
    if (!validation.success) return apiError(400, 'Validation failed', validation.error.errors);

    try {
        const partner = await PartnerService.updateMyProfile(user.email!, validation.data);
        return apiSuccess({ partner });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
