import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
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
    const { id } = await context.params;
    const user = await requireAuth();

    const body = await request.json();
    const parsed = updateRemoteSessionSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }

    const session = await RemoteSessionService.updateSession(id, user.id, parsed.data as Parameters<typeof RemoteSessionService.updateSession>[2]);
    return apiSuccess(session);
});

// DELETE /api/remote/sessions/[id]
export const DELETE = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    await RemoteSessionService.endSession(id, user.id);
    return apiSuccess({ message: 'Session ended successfully' });
});
