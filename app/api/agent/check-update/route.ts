import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/agent/check-update
// Check if a newer version is available for the agent
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { current_version, platform } = body;

        if (!current_version || !platform) {
            return apiError(400, 'Missing required fields: current_version, platform');
        }

        // Normalize platform
        const normalizedPlatform = platform.toUpperCase();
        if (!['WINDOWS', 'MACOS', 'LINUX'].includes(normalizedPlatform)) {
            return apiError(400, 'Invalid platform. Must be WINDOWS, MACOS, or LINUX');
        }

        // Get latest version from database
        // This assumes you have an AgentVersion table
        // If not, you can hardcode or use environment variables
        const latestVersion = await prisma.agentVersion.findFirst({
            where: {
                platform: normalizedPlatform,
                status: 'ACTIVE',
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (!latestVersion) {
            // No version available for this platform
            return apiSuccess(null);
        }

        // Compare versions (semantic versioning)
        const currentParts = current_version.split('.').map(Number);
        const latestParts = latestVersion.version.split('.').map(Number);

        let isNewer = false;
        for (let i = 0; i < 3; i++) {
            const current = currentParts[i] || 0;
            const latest = latestParts[i] || 0;

            if (latest > current) {
                isNewer = true;
                break;
            } else if (latest < current) {
                break;
            }
        }

        if (!isNewer) {
            // Agent is up to date
            return apiSuccess(null);
        }

        // Return update information
        return apiSuccess({
            version: latestVersion.version,
            download_url: latestVersion.downloadUrl,
            checksum: latestVersion.checksum,
            release_notes: latestVersion.releaseNotes || '',
            required: latestVersion.required || false,
        });
    } catch (error: unknown) {
        logError('Agent check update failed', error);
        return apiError(500, 'Internal server error');
    }
}
