import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { ScriptService, createScriptSchema } from '@/lib/services/ScriptService';
import { withRateLimit } from '@/lib/security/rateLimit';

/**
 * GET /api/workspaces/[id]/scripts
 * List all scripts in the workspace
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language');

    const scripts = await ScriptService.getScripts(params.id, language);
    return apiSuccess({ scripts });
});

/**
 * POST /api/workspaces/[id]/scripts
 * Create a new script in the library
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    // Only IT_STAFF level (ADMIN/OWNER roles usually) should author global scripts
    await requireWorkspaceRole(params.id, user.id, 'ADMIN');

    const data = createScriptSchema.parse(await request.json());
    const script = await ScriptService.createScript(params.id, user.id, data);
    return apiSuccess({ script }, { message: 'Script created successfully' }, 201);
});
