/**
 * POST /api/cron/auth-cleanup
 *
 * Scheduled job to clean up expired/revoked auth tokens and sessions.
 * Removes tokens and sessions older than 30 days past expiry/revocation.
 *
 * Protected by CRON_SECRET bearer token (timing-safe comparison).
 */

import { NextRequest } from 'next/server';
import { withCronHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { cleanupExpiredTokens } from '@/lib/auth/tokens';

export const POST = withCronHandler(async (_request: NextRequest) => {
    const deletedCount = await cleanupExpiredTokens();
    return apiSuccess({ deletedCount, message: `Cleaned up ${deletedCount} expired auth records` });
});
