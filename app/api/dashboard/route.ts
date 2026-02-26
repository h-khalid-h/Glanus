import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withErrorHandler, requireAuth } from '@/lib/api/withAuth';
import { verifyWorkspaceAccess } from '@/lib/workspace/utils';

export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
        return apiError(400, 'Workspace ID is required');
    }

    const dbUser = await prisma.user.findUnique({
        where: { email: user.email! },
    });
    if (!dbUser) {
        return apiError(404, 'User not found');
    }

    const { hasAccess } = await verifyWorkspaceAccess(dbUser.id, workspaceId);
    if (!hasAccess) {
        return apiError(403, 'Access denied to workspace');
    }

    // All queries scoped to workspace
    const [totalAssets, totalUsers, activeSessions, recentInsights] = await Promise.all([
        prisma.asset.count({
            where: { workspaceId, deletedAt: null },
        }),
        prisma.workspaceMember.count({
            where: { workspaceId },
        }),
        prisma.remoteSession.count({
            where: {
                status: 'ACTIVE',
                asset: { workspaceId },
            },
        }),
        prisma.aIInsight.count({
            where: {
                acknowledged: false,
                asset: { workspaceId },
            },
        }),
    ]);

    // Get recent assets for this workspace
    const recentAssets = await prisma.asset.findMany({
        where: { workspaceId, deletedAt: null },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            assignedTo: {
                select: { name: true, email: true },
            },
        },
    });

    // Get active remote sessions for this workspace
    const sessions = await prisma.remoteSession.findMany({
        where: {
            status: 'ACTIVE',
            asset: { workspaceId },
        },
        include: {
            asset: { select: { name: true, category: true } },
            user: { select: { name: true, email: true } },
        },
        take: 10,
    });

    return apiSuccess({
        stats: {
            totalAssets,
            totalUsers,
            activeSessions,
            pendingInsights: recentInsights,
        },
        recentAssets,
        activeSessions: sessions,
    });
});

