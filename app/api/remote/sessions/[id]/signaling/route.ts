import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
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
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    // simple-peer occasionally fires `signal` with payloads that the viewer
    // collapses to {} (e.g. ICE candidates without a usable `candidate`
    // string after a renegotiation, or trickle-end markers). The viewer
    // already skips PATCH when the body is empty, but keepalives, retries
    // and `restartIce()` can still produce a zero-byte body — parsing those
    // unconditionally throws `Unexpected end of JSON input` and surfaces as
    // a 500 in the dev console. Treat empty/invalid JSON as a no-op patch.
    const raw = await request.text();
    let body: unknown = {};
    if (raw.trim().length > 0) {
        try {
            body = JSON.parse(raw);
        } catch {
            throw new ApiError(400, 'Invalid JSON body');
        }
    }
    const { userId, agentToken } = await resolveSignalingCaller(request);

    const { isAuthorized, isAgent } = await RemoteSignalingService.verifySignalingAccess(id, userId, agentToken);
    if (!isAuthorized) throw new ApiError(401, 'Unauthorized');

    const updated = await RemoteSignalingService.patchSignalingState(
        id,
        body as { offer?: unknown; answer?: unknown; status?: string; iceCandidate?: unknown },
        isAgent
    );
    return apiSuccess(updated);
});
