import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { AgentService } from '@/lib/services/AgentService';
import { withRateLimit } from '@/lib/security/rateLimit';

// GET /api/agent/remote/active
// Called by the Tauri Agent Webview to check for pending remote sessions.
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'agent');
    if (rateLimitResponse) return rateLimitResponse;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new ApiError(401, 'Unauthorized');
    }

    const token = authHeader.substring(7);
    const session = await AgentService.getActiveRemoteSession(token);
    return apiSuccess({ session });
});
