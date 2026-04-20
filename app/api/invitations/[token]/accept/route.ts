import { apiSuccess, apiError } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withAuth';
import { InvitationService } from '@/lib/services/InvitationService';
import { withRateLimit } from '@/lib/security/rateLimit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { z } from 'zod';

type RouteContext = { params: Promise<{ token: string }> };

function getRequestContext(request: NextRequest) {
    return {
        ipAddress:
            request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
            request.headers.get('x-real-ip') ||
            undefined,
        userAgent: request.headers.get('user-agent') || undefined,
    };
}

const newUserSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128)
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

/**
 * POST /api/invitations/[token]/accept
 *
 * Two flows depending on authentication state:
 *
 * 1. Existing user (session present):
 *    Body: {} (no extra fields needed)
 *    Validates email match, creates workspace membership.
 *
 * 2. New user (no session):
 *    Body: { name, password }
 *    Creates the user account (email from invitation) + workspace membership atomically.
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: RouteContext,
) => {
    // Rate limit to prevent brute-force token enumeration
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const { token } = await context.params;
    const ctx = getRequestContext(request);

    const session = await getServerSession(authOptions);

    if (session?.user?.email) {
        // ── Existing authenticated user ──
        const result = await InvitationService.acceptInvitation(token, session.user.email, ctx);
        return apiSuccess(result);
    }

    // ── New user registration flow ──
    const body = await request.json().catch(() => ({}));
    const parsed = newUserSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(422, parsed.error.errors[0]?.message || 'Invalid input');
    }

    const result = await InvitationService.acceptInvitationNewUser(
        token,
        parsed.data.name,
        parsed.data.password,
        ctx,
    );
    return apiSuccess(result, undefined, 201);
});
