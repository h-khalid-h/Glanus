import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { updateRemoteSessionSchema } from '@/lib/schemas/remote-session.schemas';
import { RemoteSessionService } from '@/lib/services/RemoteSessionService';

// GET /api/remote/sessions/[id]
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    const session = await RemoteSessionService.getSessionById(id, user.id);
    return apiSuccess(session);
});

// PUT /api/remote/sessions/[id]
export const PUT = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const user = await requireAuth();

    const parsed = updateRemoteSessionSchema.parse(await request.json());
    const session = await RemoteSessionService.updateSession(id, user.id, parsed as Parameters<typeof RemoteSessionService.updateSession>[2]);
    return apiSuccess(session);
});

// DELETE /api/remote/sessions/[id]
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const user = await requireAuth();

    await RemoteSessionService.endSession(id, user.id);
    return apiSuccess({ message: 'Session ended successfully' });
});
