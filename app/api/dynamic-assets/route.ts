import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createDynamicAssetSchema } from '@/lib/schemas/dynamic-asset.schemas';
import {
    validateFieldValue,
    serializeFieldValue,
    resolveInheritedFields,
} from '@/lib/dynamic-fields';

/**
 * POST /api/dynamic-assets
 * Create a new asset with dynamic field values (EAV pattern)
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireAuth();
    const body = await request.json();

    // Validate base asset data
    const data = createDynamicAssetSchema.parse(body);

    // Verify category exists
    const category = await prisma.assetCategory.findUnique({
        where: { id: data.categoryId },
        select: {
            id: true,
            name: true,
            assetTypeValue: true,
        },
    });

    if (!category) {
        return apiError(404, 'Category not found');
    }

    // Get all field definitions for this category (including inherited)
    const allFields = await resolveInheritedFields(data.categoryId);

    // Build field definitions map for quick lookup
    const fieldDefsMap = new Map();
    for (const field of allFields) {
        fieldDefsMap.set(field.slug, field);
    }

    // Validate all provided field values
    const validationErrors: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fieldValuesToCreate: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

    for (const [fieldSlug, fieldValue] of Object.entries(data.fields)) {
        const fieldDef = fieldDefsMap.get(fieldSlug);

        if (!fieldDef) {
            validationErrors.push({
                field: fieldSlug,
                error: 'Unknown field for this category',
            });
            continue;
        }

        // Validate the field value
        const validation = await validateFieldValue(fieldValue, fieldDef);

        if (!validation.valid) {
            validationErrors.push({
                field: fieldSlug,
                error: validation.error,
            });
            continue;
        }

        // Serialize the value for EAV storage
        const serialized = serializeFieldValue(fieldValue, fieldDef.fieldType);

        fieldValuesToCreate.push({
            fieldDefinitionId: fieldDef.id,
            ...serialized,
        });
    }

    // Check for missing required fields
    for (const field of allFields) {
        if (field.isRequired && !data.fields.hasOwnProperty(field.slug)) {
            validationErrors.push({
                field: field.slug,
                error: 'Required field is missing',
            });
        }
    }

    if (validationErrors.length > 0) {
        return apiError(400, 'Validation failed');
    }

    // Create asset with field values in a transaction
    const asset = await prisma.$transaction(async (tx) => {
        // Create the asset
        const newAsset = await tx.asset.create({
            data: {
                workspaceId: (data as any).workspaceId || '', // eslint-disable-line @typescript-eslint/no-explicit-any
                name: data.name,
                description: data.description,
                assetType: category.assetTypeValue,
                categoryId: data.categoryId,
                status: data.status || 'AVAILABLE',
                assignedToId: data.assignedToId,
                tags: data.tags || [],
            },
        });

        // Create field values
        if (fieldValuesToCreate.length > 0) {
            await tx.assetFieldValue.createMany({
                data: fieldValuesToCreate.map((fv) => ({
                    ...fv,
                    assetId: newAsset.id,
                })),
            });
        }

        return newAsset;
    });

    // Fetch complete asset with relations
    const completeAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
        include: {
            category: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            fieldValues: {
                include: {
                    fieldDefinition: {
                        select: {
                            name: true,
                            label: true,
                            slug: true,
                            fieldType: true,
                        },
                    },
                },
            },
            assignedTo: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    return apiSuccess(completeAsset, undefined, 201);
});

/**
 * GET /api/dynamic-assets
 * List dynamic assets with filtering
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const categoryId = searchParams.get('categoryId') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    // Build where clause — scoped to user's workspaces
    const where: any = { // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma dynamic where
        categoryId: { not: null }, // Only dynamic assets
        workspace: {
            members: { some: { userId: user.id } },
        },
    };

    if (categoryId) {
        where.categoryId = categoryId;
    }

    if (status) {
        where.status = status as any; // Prisma enum
    }

    // Get assets with pagination
    const [assets, total] = await Promise.all([
        prisma.asset.findMany({
            where,
            skip,
            take: limit,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        icon: true,
                    },
                },
                fieldValues: {
                    include: {
                        fieldDefinition: {
                            select: {
                                name: true,
                                label: true,
                                slug: true,
                                fieldType: true,
                            },
                        },
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.asset.count({ where }),
    ]);

    return apiSuccess({
        assets,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
});
