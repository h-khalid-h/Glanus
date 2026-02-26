import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { executeActionSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { executeAction } from '@/lib/action-handlers';

/**
 * GET /api/assets/{id}/actions/{actionSlug}
 * Get details for a specific action
 */
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string; actionSlug: string }> }
) => {
    await requireAuth();
    const { id, actionSlug } = await context.params;

    // Get asset
    const asset = await prisma.asset.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            categoryId: true,
        },
    });

    if (!asset) {
        return apiError(404, 'Asset not found');
    }

    if (!asset.categoryId) {
        return apiError(400, 'Asset does not have a dynamic category');
    }

    // Get all actions for this category
    const actions = await prisma.assetActionDefinition.findMany({
        where: {
            categoryId: asset.categoryId,
            isVisible: true,
        },
        orderBy: { sortOrder: 'asc' },
        select: {
            id: true,
            name: true,
            label: true,
            slug: true,
            description: true,
            icon: true,
            actionType: true,
            isDestructive: true,
            requiresConfirmation: true,
            estimatedDuration: true,
            handlerType: true,
            parameters: true,
            buttonColor: true,
        },
    });

    return apiSuccess({
        asset: {
            id: asset.id,
            name: asset.name,
        },
        actions,
    });
});

/**
 * POST /api/assets/{id}/actions/{actionSlug}
 * Execute an action on an asset
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; actionSlug: string }> }
) => {
    await requireAuth();
    const { id, actionSlug } = await context.params;
    const body = await request.json();

    // Validate input
    const data = executeActionSchema.parse(body);

    // Get asset
    const asset = await prisma.asset.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            categoryId: true,
        },
    });

    if (!asset) {
        return apiError(404, 'Asset not found');
    }

    if (!asset.categoryId) {
        return apiError(400, 'Asset does not have a dynamic category');
    }

    // Get action definition
    const actionDefinition = await prisma.assetActionDefinition.findFirst({
        where: {
            categoryId: asset.categoryId,
            slug: actionSlug,
            isVisible: true,
        },
    });

    if (!actionDefinition) {
        return apiError(404, 'Action not found');
    }

    // Check confirmation for destructive actions
    if (actionDefinition.isDestructive && actionDefinition.requiresConfirmation && !data.confirm) {
        return apiError(400, 'Confirmation required for destructive action');
    }

    // Create execution record
    const execution = await prisma.assetActionExecution.create({
        data: {
            assetId: id,
            actionDefinitionId: actionDefinition.id,
            status: 'PENDING',
            parameters: (data.parameters || {}) as any,
            startedAt: new Date(),
        },
    });

    // Execute action asynchronously
    // In production, this should be queued to a background job system
    executeAction(
        actionDefinition as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma type mismatch
        asset,
        data.parameters || {},
        execution.id
    ).then(async (result) => {
        // Update execution with result
        await prisma.assetActionExecution.update({
            where: { id: execution.id },
            data: {
                status: result.status,
                result: result.output as any,
                errorMessage: result.error,
                completedAt: result.status === 'COMPLETED' ? new Date() : null,
            },
        });
    }).catch(async (error: unknown) => {
        // Ensure failed executions are recorded — prevents unhandled rejection
        const message = error instanceof Error ? error.message : 'Unknown execution error';
        await prisma.assetActionExecution.update({
            where: { id: execution.id },
            data: {
                status: 'FAILED',
                errorMessage: message,
                completedAt: new Date(),
            },
        }).catch(() => { /* best-effort update */ });
    });

    // Return execution record for polling
    return apiSuccess({
        execution: {
            id: execution.id,
            status: execution.status,
            startedAt: execution.startedAt,
        },
        message: 'Action execution started',
        pollUrl: `/api/executions/${execution.id}`,
    }, { status: 202 }); // 202 Accepted
});
