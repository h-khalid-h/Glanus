import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { updateDynamicAssetSchema } from '@/lib/schemas/dynamic-asset.schemas';
import {
    validateFieldValue,
    serializeFieldValue,
    resolveInheritedFields,
} from '@/lib/dynamic-fields';

/**
 * PATCH /api/dynamic-assets/{id}
 * Update an existing dynamic asset and its field values
 */
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const user = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();

    // Validate input
    const data = updateDynamicAssetSchema.parse(body);

    // Get existing asset — verify workspace access
    const existingAsset = await prisma.asset.findFirst({
        where: {
            id,
            workspace: {
                members: { some: { userId: user.id } },
            },
        },
        select: {
            id: true,
            categoryId: true,
            fieldValues: {
                select: {
                    id: true,
                    fieldDefinitionId: true,
                    valueString: true,
                    valueNumber: true,
                    valueBoolean: true,
                    valueDate: true,
                    valueJson: true,
                    fieldDefinition: {
                        select: {
                            fieldType: true,
                        },
                    },
                },
            },
        },
    });

    if (!existingAsset) {
        return apiError(404, 'Asset not found');
    }

    if (!existingAsset.categoryId) {
        return apiError(400, 'Asset does not have a dynamic category');
    }

    // Handle category change if provided
    const targetCategoryId = data.categoryId || existingAsset.categoryId;

    // Get all field definitions for target category
    const allFields = await resolveInheritedFields(targetCategoryId);
    const fieldDefsMap = new Map();
    for (const field of allFields) {
        fieldDefsMap.set(field.slug, field);
    }

    // Validate field updates if provided
    const validationErrors: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fieldUpdates: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (data.fields) {
        // Build map of existing field values
        const existingValuesMap = new Map();
        for (const fv of existingAsset.fieldValues) {
            existingValuesMap.set(fv.fieldDefinitionId, fv);
        }

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
            const validation = await validateFieldValue(fieldValue, fieldDef, id);

            if (!validation.valid) {
                validationErrors.push({
                    field: fieldSlug,
                    error: validation.error,
                });
                continue;
            }

            // Serialize the value
            const serialized = serializeFieldValue(fieldValue, fieldDef.fieldType);

            // Check if we're updating or creating
            const existingValue = existingValuesMap.get(fieldDef.id);

            fieldUpdates.push({
                existingValueId: existingValue?.id,
                fieldDefinitionId: fieldDef.id,
                ...serialized,
            });
        }
    }

    if (validationErrors.length > 0) {
        return apiError(400, 'Validation failed');
    }

    // Update asset in transaction
    await prisma.$transaction(async (tx) => {
        // Update base asset fields
        await tx.asset.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.categoryId && { categoryId: data.categoryId }),
                ...(data.status && { status: data.status }),
                ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
                ...(data.tags && { tags: data.tags }),
                ...(data.metadata && { metadata: data.metadata as any }), // Prisma JSON field
            },
        });

        // Update field values
        for (const fieldUpdate of fieldUpdates) {
            if (fieldUpdate.existingValueId) {
                await tx.assetFieldValue.update({
                    where: { id: fieldUpdate.existingValueId },
                    data: {
                        valueString: fieldUpdate.valueString,
                        valueNumber: fieldUpdate.valueNumber,
                        valueBoolean: fieldUpdate.valueBoolean,
                        valueDate: fieldUpdate.valueDate,
                        valueJson: fieldUpdate.valueJson,
                    },
                });
            } else {
                await tx.assetFieldValue.create({
                    data: {
                        assetId: id,
                        fieldDefinitionId: fieldUpdate.fieldDefinitionId,
                        valueString: fieldUpdate.valueString,
                        valueNumber: fieldUpdate.valueNumber,
                        valueBoolean: fieldUpdate.valueBoolean,
                        valueDate: fieldUpdate.valueDate,
                        valueJson: fieldUpdate.valueJson,
                    },
                });
            }
        }
    });

    // Fetch complete updated asset
    const completeAsset = await prisma.asset.findUnique({
        where: { id },
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

    return apiSuccess(completeAsset);
});
