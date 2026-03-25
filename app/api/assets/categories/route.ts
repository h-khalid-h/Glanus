import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { createCategorySchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAuth } from '@/lib/api/withAuth';
import { AssetCategoryAdminService, CreateCategoryInput } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';
import { prisma } from '@/lib/db';

// GET /api/assets/categories — list categories for the workspace
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireAuth();
    const { searchParams } = new URL(request.url);
    const assetType = searchParams.get('assetType') || undefined;

    const categories = await prisma.assetCategory.findMany({
        where: {
            ...(assetType && { assetTypeValue: assetType }),
            isActive: true,
        },
        include: {
            parent: true,
            fieldDefinitions: { orderBy: { sortOrder: 'asc' } },
            children: { orderBy: { sortOrder: 'asc' } },
        } as never,
        orderBy: [{ assetTypeValue: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    return apiSuccess(categories);
});

// POST /api/assets/categories — create a new category (admin/owner only)
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const data = await validateRequest(request, createCategorySchema);
    const category = await AssetCategoryAdminService.createCategory(data as CreateCategoryInput, user.id);
    return apiSuccess(category, undefined, 201);
});
