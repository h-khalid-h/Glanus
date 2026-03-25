import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { MdmService } from '@/lib/services/MdmService';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

const CreateProfileSchema = z.object({
    name: z.string().min(1, 'name is required'),
    description: z.string().optional(),
    platform: z.enum(['WINDOWS', 'MACOS', 'LINUX'], {
        errorMap: () => ({ message: 'platform must be WINDOWS, MACOS, or LINUX' }),
    }),
    profileType: z.string().min(1, 'profileType is required'),
    configPayload: z.unknown(),
});

// GET /api/workspaces/[id]/mdm/profiles
export const GET = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const rateLimited = await withRateLimit(req, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER', req);

    const url = new URL(req.url);
    const platform = url.searchParams.get('platform');
    const profiles = await MdmService.getProfiles(workspaceId, platform);
    return apiSuccess(profiles);
});

// POST /api/workspaces/[id]/mdm/profiles
export const POST = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const rateLimited = await withRateLimit(req, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', req);

    const body = CreateProfileSchema.parse(await req.json());
    const profile = await MdmService.createProfile(workspaceId, body);
    return apiSuccess(profile, { message: 'MDM profile created successfully' }, 201);
});
