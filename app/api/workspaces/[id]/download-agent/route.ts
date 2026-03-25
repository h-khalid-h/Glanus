import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { downloadAgentSchema } from '@/lib/schemas/workspace.schemas';
import { storePreAuthToken } from '@/lib/security/preauth-store';
import crypto from 'crypto';

// POST - Generate download link with embedded token
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const { platform } = downloadAgentSchema.parse(await request.json());

    // Generate pre-auth token (valid for 7 days) and store for validation
    const preAuthToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    storePreAuthToken(preAuthToken, workspaceId);

    const downloadInfo = {
        platform,
        workspaceId,
        preAuthToken,
        expiresAt,
        downloadUrl: ({
            windows: `/downloads/glanus-agent-${workspaceId}.msi`,
            macos: `/downloads/glanus-agent-${workspaceId}.pkg`,
            linux: `/downloads/glanus-agent-${workspaceId}.deb`,
        } as Record<string, string>)[platform],
        config: {
            workspaceId,
            preAuthToken,
            apiEndpoint: process.env.NEXT_PUBLIC_API_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000',
        },
    };

    return apiSuccess(downloadInfo);
});
