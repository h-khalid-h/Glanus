import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { bulkDeleteSchema } from '@/lib/schemas/asset.schemas';

// POST /api/assets/bulk/delete - Bulk soft delete assets
export const POST = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }
    const { assetIds } = parsed.data;

    const result = await prisma.asset.updateMany({
        where: {
            id: { in: assetIds },
            deletedAt: null,
            workspace: {
                members: { some: { userId: user.id } },
            },
        },
        data: { deletedAt: new Date(), status: 'RETIRED' },
    });

    await Promise.all(
        assetIds.map(assetId =>
            prisma.auditLog.create({
                data: {
                    action: 'DELETE',
                    resourceType: 'Asset',
                    resourceId: assetId,
                    userId: user.id,
                    metadata: {
                        message: 'Asset bulk deleted',
                        deletedBy: user.email,
                    },
                },
            })
        )
    );

    return apiSuccess({
        deletedCount: result.count,
        message: `Successfully deleted ${result.count} asset(s)`,
    });
});
