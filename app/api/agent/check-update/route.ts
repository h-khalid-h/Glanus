import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { AgentService } from '@/lib/services/AgentService';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { current_version, platform } = body;

        if (!current_version || !platform) {
            return apiError(400, 'Missing required fields: current_version, platform');
        }

        if (!['WINDOWS', 'MACOS', 'LINUX'].includes(platform.toUpperCase())) {
            return apiError(400, 'Invalid platform. Must be WINDOWS, MACOS, or LINUX');
        }

        const update = await AgentService.checkForUpdate(current_version, platform);
        return apiSuccess(update);
    } catch (error: unknown) {
        logError('Agent check update failed', error);
        return apiError(500, 'Internal server error');
    }
}
