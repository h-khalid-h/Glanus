import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { RemoteSignalingService } from '@/lib/services/RemoteSignalingService';

interface RouteContext {
    params: Promise<{ id: string }>;
}

/**
 * Dual-auth helper: accepts either a user session cookie OR an agent bearer token.
 * Returns { userId, agentToken } — exactly one will be set.
 */
async function resolveSignalingCaller(request: NextRequest): Promise<{ userId: string | null; agentToken: string | null }> {
    try {
        const user = await requireAuth();
        return { userId: user.id, agentToken: null };
    } catch {
        const authHeader = request.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            return { userId: null, agentToken: authHeader.substring(7) };
        }
        return { userId: null, agentToken: null };
    }
}

// GET /api/remote/sessions/[id]/signaling
export const GET = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const { userId, agentToken } = await resolveSignalingCaller(request);

    const { isAuthorized } = await RemoteSignalingService.verifySignalingAccess(id, userId, agentToken);
    if (!isAuthorized) throw new ApiError(401, 'Unauthorized');

    const session = await RemoteSignalingService.getSignalingState(id);
    return apiSuccess(session);
});

// PATCH /api/remote/sessions/[id]/signaling
export const PATCH = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const body = await request.json();
    const { userId, agentToken } = await resolveSignalingCaller(request);

    const { isAuthorized, isAgent } = await RemoteSignalingService.verifySignalingAccess(id, userId, agentToken);
    if (!isAuthorized) throw new ApiError(401, 'Unauthorized');

    const updated = await RemoteSignalingService.patchSignalingState(id, body, isAgent);
    return apiSuccess(updated);
});
