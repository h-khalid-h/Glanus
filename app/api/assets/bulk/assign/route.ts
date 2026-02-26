import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { bulkAssignSchema } from '@/lib/schemas/asset.schemas';

// POST /api/assets/bulk/assign - Bulk assign assets to a user
export const POST = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    const body = await request.json();
    const parsed = bulkAssignSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }
    const { assetIds, userId } = parsed.data;

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
        return apiError(404, 'User not found');
    }

    const assets = await prisma.asset.findMany({
        where: {
            id: { in: assetIds },
            deletedAt: null,
            workspace: {
                members: { some: { userId: user.id } },
            },
        },
    });
    if (assets.length !== assetIds.length) {
        return apiError(400, 'One or more assets not found or access denied');
    }

    await prisma.asset.updateMany({
        where: { id: { in: assetIds } },
        data: { assignedToId: userId, status: 'ASSIGNED' },
    });

    await Promise.all(
        assetIds.map(assetId =>
            prisma.auditLog.create({
                data: {
                    action: 'UPDATE',
                    resourceType: 'Asset',
                    resourceId: assetId,
                    userId: user.id,
                    metadata: {
                        message: `Asset bulk assigned to ${targetUser.name}`,
                        assigneeId: userId,
                        assigneeName: targetUser.name,
                        assigneeEmail: targetUser.email,
                    },
                },
            })
        )
    );

    return apiSuccess({
        assignedCount: assetIds.length,
        message: `Successfully assigned ${assetIds.length} asset(s) to ${targetUser.name}`,
    });
});
