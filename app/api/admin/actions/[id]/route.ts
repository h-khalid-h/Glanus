import { withErrorHandler, requireAdmin } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { updateActionDefinitionSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { z } from 'zod';

type RouteParams = {
    params: Promise<{ id: string }>;
};

export const PUT = withErrorHandler(async (
    request: NextRequest,
    { params }: RouteParams
) => {
    await requireAdmin();
    try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const data = updateActionDefinitionSchema.parse(body);

        // Check if action exists
        const existingAction = await prisma.assetActionDefinition.findUnique({
            where: { id },
            select: { categoryId: true, slug: true },
        });

        if (!existingAction) {
            return apiError(404, 'Action definition not found');
        }

        // If slug is being updated, check for conflicts
        if (data.slug && data.slug !== existingAction.slug) {
            const slugConflict = await prisma.assetActionDefinition.findFirst({
                where: {
                    categoryId: existingAction.categoryId,
                    slug: data.slug,
                    id: { not: id },
                },
            });

            if (slugConflict) {
                return apiError(400, 'An action with this slug already exists in this category');
            }
        }

        // Update action definition
        const action = await prisma.assetActionDefinition.update({
            where: { id },
            data: {
                ...data,
                handlerConfig: data.handlerConfig as any, // Prisma JSON compatibility
                parameters: data.parameters as any, // Prisma JSON compatibility
            },
        });

        return apiSuccess(action);
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return apiError(400, 'Validation failed', error.errors);
        }
        logError('Failed to update action definition', error);
        return apiError(500, 'Failed to update action definition');
    }
});

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: RouteParams
) => {
    await requireAdmin();
    try {
        const { id } = await params;

        // Check if action exists
        const action = await prisma.assetActionDefinition.findUnique({
            where: { id },
            select: { id: true, name: true },
        });

        if (!action) {
            return apiError(404, 'Action definition not found');
        }

        // Check if any executions exist for this action
        const executionCount = await prisma.assetActionExecution.count({
            where: { actionDefinitionId: id },
        });

        // Soft delete approach - we don't want to lose execution history
        // Instead of deleting, we'll mark as inactive by updating isVisible to false
        if (executionCount > 0) {
            // Update to hide the action instead of deleting
            const updatedAction = await prisma.assetActionDefinition.update({
                where: { id },
                data: { isVisible: false },
            });

            return apiSuccess({
                message: `Action has ${executionCount} execution(s). Marked as hidden instead of deleting.`,
                action: updatedAction,
                executionCount,
            });
        }

        // If no executions, safe to delete
        await prisma.assetActionDefinition.delete({
            where: { id },
        });

        return apiSuccess({
            message: 'Action definition deleted successfully',
            deletedAction: action,
        });
    } catch (error: unknown) {
        logError('Failed to delete action definition', error);
        return apiError(500, 'Failed to delete action definition');
    }
});
