import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/withAuth';
import { RemoteSignalingService } from '@/lib/services/RemoteSignalingService';

interface RouteContext {
    params: Promise<{ id: string }>;
}

// GET /api/remote/sessions/[id]/signaling
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;

        // Dual-auth: try user session, fall back to agent bearer token
        let userId: string | null = null;
        let agentToken: string | null = null;

        try {
            const user = await requireAuth();
            if (user) userId = user.id;
        } catch {
            const authHeader = request.headers.get('Authorization');
            if (authHeader?.startsWith('Bearer ')) {
                agentToken = authHeader.substring(7);
            }
        }

        const { isAuthorized } = await RemoteSignalingService.verifySignalingAccess(id, userId, agentToken);
        if (!isAuthorized) return apiError(401, 'Unauthorized');

        const session = await RemoteSignalingService.getSignalingState(id);
        return apiSuccess(session);
    } catch (error: unknown) {
        const e = error as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, 'Failed to fetch signaling data', e.message);
    }
}

// PATCH /api/remote/sessions/[id]/signaling
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json();

        let userId: string | null = null;
        let agentToken: string | null = null;

        try {
            const user = await requireAuth();
            if (user) userId = user.id;
        } catch {
            const authHeader = request.headers.get('Authorization');
            if (authHeader?.startsWith('Bearer ')) {
                agentToken = authHeader.substring(7);
            }
        }

        const { isAuthorized, isAgent } = await RemoteSignalingService.verifySignalingAccess(id, userId, agentToken);
        if (!isAuthorized) return apiError(401, 'Unauthorized');

        const updated = await RemoteSignalingService.patchSignalingState(id, body, isAgent);
        return apiSuccess(updated);
    } catch (error: unknown) {
        const e = error as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, 'Failed to update signaling data', e.message);
    }
}
