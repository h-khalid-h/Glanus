import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AccountService } from '@/lib/services/AccountService';
import { z } from 'zod';

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128)
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

// POST /api/auth/reset-password — Validate token and set new password
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) return apiError(400, parsed.error.errors[0].message);

    try {
        await AccountService.resetPassword(parsed.data.token, parsed.data.password);
        return apiSuccess({ message: 'Password has been reset successfully. You can now sign in.' });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 400, e.message || 'Reset failed');
    }
});
