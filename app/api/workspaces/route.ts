import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { sanitizeText } from '@/lib/security/sanitize';
import { createSampleWorkspaceData } from '@/lib/seed/sampleWorkspaceData';

const createWorkspaceSchema = z.object({
    name: z.string().min(1, 'Workspace name is required').max(100),
    slug: z.string()
        .min(3, 'Slug must be at least 3 characters')
        .max(50, 'Slug must be at most 50 characters')
        .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    description: z.string().max(500).optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    plan: z.enum(['FREE', 'PERSONAL', 'TEAM', 'ENTERPRISE']).default('FREE'),
    createSampleData: z.boolean().optional().default(false),
});

// GET /api/workspaces - List all workspaces for current user
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();

    const workspaces = await prisma.workspace.findMany({
        where: {
            OR: [
                { ownerId: user.id },
                { members: { some: { userId: user.id } } },
            ],
        },
        include: {
            subscription: {
                select: {
                    plan: true,
                    status: true,
                    maxAssets: true,
                    aiCreditsUsed: true,
                    maxAICreditsPerMonth: true,
                },
            },
            members: {
                select: { id: true, role: true },
            },
            _count: {
                select: { assets: true, members: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    const workspacesWithRole = workspaces.map((workspace) => {
        const membership = workspace.members.find((m) => m.id === user.id);
        const isOwner = workspace.ownerId === user.id;

        return {
            ...workspace,
            userRole: isOwner ? 'OWNER' : (membership?.role || 'VIEWER'),
        };
    });

    return apiSuccess({ workspaces: workspacesWithRole });
});

// POST /api/workspaces - Create a new workspace
export const POST = withErrorHandler(async (request: Request) => {
    const user = await requireAuth();

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit(`workspace-create-${clientIp}`, 'api');
    if (!rateLimitResult.allowed) {
        return apiError(429, 'Rate limit exceeded');
    }

    const body = await request.json();
    const validation = createWorkspaceSchema.safeParse(body);
    if (!validation.success) {
        return apiError(400, 'Validation failed', validation.error.errors);
    }

    const data = validation.data;

    // Check slug uniqueness
    const existingWorkspace = await prisma.workspace.findUnique({
        where: { slug: data.slug },
    });
    if (existingWorkspace) {
        return apiError(409, 'Workspace slug already taken');
    }

    const sanitizedName = sanitizeText(data.name);
    const sanitizedDescription = data.description ? sanitizeText(data.description) : null;
    const planLimits = getPlanLimits(data.plan);

    // Create workspace with subscription and membership in transaction
    const workspace = await prisma.$transaction(async (tx) => {
        const newWorkspace = await tx.workspace.create({
            data: {
                name: sanitizedName,
                slug: data.slug,
                description: sanitizedDescription,
                primaryColor: data.primaryColor || '#3B82F6',
                accentColor: data.accentColor || '#10B981',
                ownerId: user.id,
            },
        });

        await tx.subscription.create({
            data: {
                workspaceId: newWorkspace.id,
                plan: data.plan,
                status: 'ACTIVE',
                ...planLimits,
            },
        });

        await tx.workspaceMember.create({
            data: {
                workspaceId: newWorkspace.id,
                userId: user.id,
                role: 'OWNER',
            },
        });

        return newWorkspace;
    });

    // Create sample data if requested (non-blocking)
    if (data.createSampleData) {
        try {
            await createSampleWorkspaceData(prisma, {
                workspaceId: workspace.id,
                userId: user.id,
            });
        } catch (error: unknown) {
            logError('Failed to create sample data', error);
        }
    }

    const completeWorkspace = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        include: {
            subscription: true,
            _count: { select: { assets: true, members: true } },
        },
    });

    return apiSuccess({ workspace: completeWorkspace }, undefined, 201);
});

// Helper: plan limits
function getPlanLimits(plan: string) {
    const limits = {
        FREE: { maxAssets: 5, maxAICreditsPerMonth: 100, maxStorageMB: 1024 },
        PERSONAL: { maxAssets: 50, maxAICreditsPerMonth: 1000, maxStorageMB: 10240 },
        TEAM: { maxAssets: 200, maxAICreditsPerMonth: 5000, maxStorageMB: 51200 },
        ENTERPRISE: { maxAssets: 999999, maxAICreditsPerMonth: 999999, maxStorageMB: 999999 },
    };

    return limits[plan as keyof typeof limits] || limits.FREE;
}
