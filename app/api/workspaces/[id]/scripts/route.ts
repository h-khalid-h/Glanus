import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ScriptService, createScriptSchema } from '@/lib/services/ScriptService';

/**
 * GET /api/workspaces/[id]/scripts
 * List all scripts in the workspace
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language');

    try {
        const scripts = await ScriptService.getScripts(params.id, language);
        return apiSuccess({ scripts });
    } catch (_error) {
        return apiError(500, 'Failed to fetch scripts');
    }
});

/**
 * POST /api/workspaces/[id]/scripts
 * Create a new script in the library
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();
    // Only IT_STAFF level (ADMIN/OWNER roles usually) should author global scripts 
    await requireWorkspaceRole(params.id, user.id, 'ADMIN');

    const body = await request.json();
    const data = createScriptSchema.safeParse(body);

    if (!data.success) {
        return apiError(400, data.error.errors[0].message);
    }

    try {
        const script = await ScriptService.createScript(params.id, user.id, data.data);
        return apiSuccess({ script }, { message: 'Script created successfully' }, 201);
    } catch (_error) {
        return apiError(500, 'Failed to create script');
    }
});
