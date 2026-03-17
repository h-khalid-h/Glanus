import { apiSuccess, apiError } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { PartnerService } from '@/lib/services/PartnerService';

const partnerSignupSchema = z.object({
    companyName: z.string().min(2).max(100),
    businessNumber: z.string().optional(),
    website: z.string().url().optional().nullable(),
    phone: z.string().min(10).max(20).optional(),
    bio: z.string().max(1000).optional(),
    address: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    region: z.string().max(100).optional(),
    country: z.string().length(2).default('US'),
    timezone: z.string().optional(),
    serviceRadius: z.number().int().min(0).max(500).optional(),
    remoteOnly: z.boolean().default(false),
    industries: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
    languages: z.array(z.string()).default(['en']),
});

// POST /api/partners/signup
export const POST = withErrorHandler(async (request: Request) => {
    const user = await requireAuth();

    const clientIp = (request as unknown as { headers: { get: (h: string) => string | null } }).headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit(`partner-signup-${clientIp}`, 'api');
    if (!rateLimitResult.allowed) return apiError(429, 'Rate limit exceeded');

    const body = await request.json();
    const validation = partnerSignupSchema.safeParse(body);
    if (!validation.success) return apiError(400, 'Validation failed', validation.error.errors);

    const partner = await PartnerService.applyAsPartner({ ...validation.data, userId: user.id, userEmail: user.email! });
    return apiSuccess({ partner, message: 'Partner application submitted successfully.' }, undefined, 201);
});
