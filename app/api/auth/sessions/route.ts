/**
 * GET    /api/auth/sessions         — List active sessions for current user
 * DELETE /api/auth/sessions?id=xxx  — Revoke a specific session
 */

import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { listActiveSessions, revokeSession, invalidateAllUserTokens } from '@/lib/auth/tokens';

/** List active sessions for this user. */
export const GET = withErrorHandler(async (_request: NextRequest) => {
    const user = await requireAuth();
    const sessions = await listActiveSessions(user.id);
    return apiSuccess({ sessions });
});

/** Revoke a session. Pass ?id=xxx to revoke a specific session, or ?all=true to revoke all. */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();
    const sessionId = request.nextUrl.searchParams.get('id');
    const revokeAll = request.nextUrl.searchParams.get('all') === 'true';

    if (revokeAll) {
        await invalidateAllUserTokens(user.id);
        return apiSuccess({ message: 'All sessions revoked' });
    }

    if (!sessionId) {
        throw new ApiError(400, 'Session ID is required');
    }

    await revokeSession(sessionId, user.id);
    return apiSuccess({ message: 'Session revoked' });
});
