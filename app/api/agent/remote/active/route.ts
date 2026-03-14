import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { AgentService } from '@/lib/services/AgentService';

// GET /api/agent/remote/active
// Called by the Tauri Agent Webview to check for pending remote sessions.
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return apiError(401, 'Unauthorized');
        }

        const token = authHeader.substring(7);
        const session = await AgentService.getActiveRemoteSession(token);

        return apiSuccess({ session });
    } catch (error: unknown) {
        const err = error as { statusCode?: number; message?: string };
        if (err.statusCode) return apiError(err.statusCode, err.message || 'Error');
        return apiError(500, 'Failed to fetch active remote session', (error as Error).message);
    }
}
