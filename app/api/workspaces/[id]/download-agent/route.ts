import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { downloadAgentSchema } from '@/lib/schemas/workspace.schemas';
import { storePreAuthToken } from '@/lib/security/preauth-store';
import { withRateLimit } from '@/lib/security/rateLimit';
import crypto from 'crypto';

// POST - Generate download link with embedded token
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const { platform } = downloadAgentSchema.parse(await request.json());

    // Generate pre-auth token (valid for 7 days) and store for validation
    const preAuthToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    storePreAuthToken(preAuthToken, workspaceId);

    const apiEndpoint = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    const queryParams = `token=${preAuthToken}&url=${encodeURIComponent(apiEndpoint)}&workspaceId=${workspaceId}`;

    const downloadInfo = {
        platform,
        workspaceId,
        preAuthToken,
        expiresAt,
        downloadUrl: ({
            windows: `/api/downloads/glanus-agent-${workspaceId}.msi`,
            macos: `/api/downloads/glanus-agent-${workspaceId}.pkg`,
            linux: `/api/downloads/glanus-agent-${workspaceId}.deb`,
        } as Record<string, string>)[platform],
        installScriptUrl: ({
            windows: `/api/install-windows?${queryParams}`,
            macos: `/api/install-macos?${queryParams}`,
            linux: `/api/install-linux?${queryParams}`,
        } as Record<string, string>)[platform],
        config: {
            workspaceId,
            preAuthToken,
            apiEndpoint,
        },
    };

    return apiSuccess(downloadInfo);
});
