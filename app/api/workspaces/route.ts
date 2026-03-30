import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { checkRateLimit, withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceService, CreateWorkspaceInput } from '@/lib/services/WorkspaceService';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
    name: z.string().min(1, 'Workspace name is required').max(100),
    slug: z.string()
        .min(3, 'Slug must be at least 3 characters')
        .max(50, 'Slug must be at most 50 characters')
        .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    description: z.string().max(500).optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    plan: z.enum(['FREE']).default('FREE'),  // Paid plans are set via Stripe checkout, not user input
    createSampleData: z.boolean().optional().default(false),
});

// GET /api/workspaces - List all workspaces for current user
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    const workspaces = await WorkspaceService.listWorkspaces(user.id);
    return apiSuccess({ workspaces });
});

// POST /api/workspaces - Create a new workspace
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit(`workspace-create-${clientIp}`, 'api');
    if (!rateLimitResult.allowed) return apiError(429, 'Rate limit exceeded');

    const body = await request.json();
    const validation = createWorkspaceSchema.parse(body);

    const data = validation;

    const workspace = await WorkspaceService.createWorkspace(user.id, data as CreateWorkspaceInput);
    return apiSuccess({ workspace }, undefined, 201);
});
