/**
 * GET  /api/auth/verify-email?token=xxx  — Verify email address
 * POST /api/auth/verify-email             — Resend verification email
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, requireAuth } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { verifyEmailToken, sendVerificationEmail } from '@/lib/auth/email-verification';
import { withRateLimit } from '@/lib/security/rateLimit';

/** Verify — user clicks the link from their inbox. */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    try {
        const { userId } = await verifyEmailToken(token);
        // Redirect to app with success indicator
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        return NextResponse.redirect(`${baseUrl}/login?verified=true`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed';
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        return NextResponse.redirect(
            `${baseUrl}/login?error=${encodeURIComponent(message)}`
        );
    }
});

/** Resend — authenticated user requests a new verification email. */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();

    if (user.emailVerified) {
        return apiSuccess({ message: 'Email is already verified' });
    }

    await sendVerificationEmail(user.id, user.email);
    return apiSuccess({ message: 'Verification email sent' });
});
