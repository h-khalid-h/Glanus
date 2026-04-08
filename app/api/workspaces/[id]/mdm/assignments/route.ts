import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { MdmService } from '@/lib/services/MdmService';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

const AssignProfileSchema = z.object({
    profileId: z.string().min(1, 'profileId is required'),
    assetIds: z.array(z.string()).min(1, 'assetIds must be a non-empty array'),
});

// GET /api/workspaces/[id]/mdm/assignments
export const GET = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceAccess(workspaceId, user.id, req);

    const url = new URL(req.url);
    const profileId = url.searchParams.get('profileId');
    const assignments = await MdmService.getAssignments(workspaceId, profileId);
    return apiSuccess(assignments);
});

// POST /api/workspaces/[id]/mdm/assignments
export const POST = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceAccess(workspaceId, user.id, req);

    const body = AssignProfileSchema.parse(await req.json());
    const result = await MdmService.assignProfiles(workspaceId, body);
    return apiSuccess(result, { message: 'MDM profile assigned successfully' }, 201);
});
