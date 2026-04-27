import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { requirePermission } from '@/lib/rbac/middleware';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { validateRequest } from '@/lib/validation';
import { AgentService } from '@/lib/services/AgentService';
import { AssetType } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string; agentId: string }> };

/**
 * Body schema — all fields are optional overrides. When omitted, the service
 * derives sensible defaults from the agent's reported metadata.
 */
const createAssetFromAgentSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    assetType: z.nativeEnum(AssetType).optional(),
    location: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/workspaces/[id]/agents/[agentId]/create-asset
 *
 * Creates a new Asset from an unlinked Agent and links them.
 *
 * Authorization:
 *   - Authenticated user
 *   - Workspace member
 *   - Permission: assets.create
 *
 * Responses:
 *   201 — asset created and linked
 *   404 — agent not found in this workspace
 *   409 — agent already linked to an asset
 */
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, agentId } = await params;

    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id, request);
    await requirePermission(user.id, 'assets', 'create', workspaceId);

    const body = await validateRequest(request, createAssetFromAgentSchema);

    const result = await AgentService.createAssetFromAgent({
        agentId,
        workspaceId,
        userId: user.id,
        overrides: body,
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return apiSuccess(result, undefined, 201);
});
