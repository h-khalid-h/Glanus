import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler, runWithUserRLS } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { createRemoteSessionSchema } from '@/lib/schemas/remote-session.schemas';
import { RemoteSessionService } from '@/lib/services/RemoteSessionService';

// GET /api/remote/sessions
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    return runWithUserRLS(user, async () => {
        const result = await RemoteSessionService.getSessions({
            userId: user.id,
            status: searchParams.get('status') || undefined,
            assetId: searchParams.get('assetId') || undefined,
            filterUserId: searchParams.get('userId') || undefined,
            page: parseInt(searchParams.get('page') || '1', 10) || 1,
            limit: Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 200),
        });

        return apiSuccess(result);
    });
});

// POST /api/remote/sessions
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();

    if (user.role !== 'ADMIN' && user.role !== 'IT_STAFF') {
        return apiError(403, 'Forbidden - Insufficient permissions');
    }

    const parsed = createRemoteSessionSchema.parse(await request.json());
    return runWithUserRLS(user, async () => {
        const session = await RemoteSessionService.createSession({
            userId: user.id,
            assetId: parsed.assetId,
            notes: parsed.notes,
            offer: parsed.offer as Record<string, unknown> | undefined,
        });
        return apiSuccess(session, undefined, 201);
    });
});
