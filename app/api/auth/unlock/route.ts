/**
 * Account Unlock API
 * Allows manual unlock of locked accounts (admin only)
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { resetRateLimit, withRateLimit } from '@/lib/security/rateLimit';
import { unlockSchema } from '@/lib/schemas/workspace.schemas';

// POST /api/auth/unlock - Unlock a locked account (admin only)
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();

    if (user.role !== 'ADMIN') {
        return apiError(403, 'Forbidden');
    }

    const { email } = unlockSchema.parse(await request.json());

    await resetRateLimit(email, 'login');

    return apiSuccess({ message: `Account for ${email} has been unlocked`, email });
});
