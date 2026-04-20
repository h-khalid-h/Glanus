import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { z } from 'zod';

/**
 * GET /api/admin/workspaces/[workspaceId]
 * Returns full workspace detail including members, assets summary, and agents.
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const { workspaceId } = await params;

    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logo: true,
            primaryColor: true,
            accentColor: true,
            ownerId: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            owner: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    platformRole: {
                        select: { id: true, name: true, label: true, color: true },
                    },
                },
            },
            subscription: {
                select: {
                    id: true,
                    plan: true,
                    status: true,
                    currentPeriodStart: true,
                    currentPeriodEnd: true,
                    aiCreditsUsed: true,
                    storageUsedMB: true,
                    maxAssets: true,
                    maxAICreditsPerMonth: true,
                    maxStorageMB: true,
                    stripeCustomerId: true,
                    stripeSubscriptionId: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            members: {
                orderBy: { joinedAt: 'asc' },
                select: {
                    id: true,
                    role: true,
                    joinedAt: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            isStaff: true,
                            emailVerified: true,
                            platformRole: {
                                select: { id: true, name: true, label: true, color: true, isStaff: true },
                            },
                        },
                    },
                },
            },
            _count: {
                select: {
                    members: true,
                    assets: true,
                    agentConnections: true,
                    tickets: true,
                },
            },
        },
    });

    if (!workspace) {
        throw new ApiError(404, 'Workspace not found');
    }

    return apiSuccess({ workspace });
});

const patchSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
});

/**
 * PATCH /api/admin/workspaces/[workspaceId]
 * Update workspace name / description.
 */
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const { workspaceId } = await params;
    const body = await request.json();
    const data = patchSchema.parse(body);

    const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data,
        select: { id: true, name: true, slug: true, description: true },
    });

    return apiSuccess({ workspace });
});
