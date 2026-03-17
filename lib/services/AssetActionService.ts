import { ApiError } from '@/lib/errors';
/**
 * AssetActionService — Dynamic asset action dispatch, execution tracking, and status polling.
 *
 * Responsibilities:
 *  - listActions: enumerate available action definitions for an asset (derived from category)
 *  - getActionBySlug: fetch a specific action definition by URL slug
 *  - executeAction: validate, persist, and asynchronously dispatch an action execution (202 Accepted)
 *  - getExecution: poll execution status by ID with asset + actionDefinition joins
 *
 * Note: action handler implementations live in lib/action-handlers/
 * Note: AssetService handles CRUD; AssetBulkService handles bulk operations.
 */
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export class AssetActionService {
    /**
     * List all action definitions available for an asset (from its category).
     */
    static async listActions(assetId: string) {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId },
            include: {
                category: {
                    include: { actionDefinitions: { orderBy: { sortOrder: 'asc' } } },
                },
            },
        });

        if (!asset) throw new ApiError(404, 'Asset not found');

        if (!asset.categoryId) {
            return { assetId, assetName: asset.name, categoryId: null, categoryName: null, actions: [] };
        }

        const actions = asset.category?.actionDefinitions || [];
        return {
            assetId, assetName: asset.name, categoryId: asset.categoryId, categoryName: asset.category?.name,
            actions: actions.map((action) => ({
                id: action.id, name: action.name, label: action.label, slug: action.slug,
                description: action.description, icon: action.icon, actionType: action.actionType,
                isDestructive: action.isDestructive, requiresConfirmation: action.requiresConfirmation,
                estimatedDuration: action.estimatedDuration, buttonColor: action.buttonColor,
                parameters: action.parameters,
            })),
        };
    }

    /**
     * Fetch a specific action definition by its slug (and all sibling actions for context).
     */
    static async getActionBySlug(assetId: string, actionSlug: string) {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId }, select: { id: true, name: true, categoryId: true },
        });
        if (!asset) throw new ApiError(404, 'Asset not found');
        if (!asset.categoryId) throw new ApiError(400, 'Asset does not have a dynamic category');

        const actions = await prisma.assetActionDefinition.findMany({
            where: { categoryId: asset.categoryId, isVisible: true },
            orderBy: { sortOrder: 'asc' },
            select: {
                id: true, name: true, label: true, slug: true, description: true, icon: true,
                actionType: true, isDestructive: true, requiresConfirmation: true,
                estimatedDuration: true, handlerType: true, parameters: true, buttonColor: true,
            },
        });

        const action = actions.find((a) => a.slug === actionSlug);
        if (!action) throw new ApiError(404, 'Action not found');

        return { asset: { id: asset.id, name: asset.name }, action, actions };
    }

    /**
     * Validate pre-conditions, persist an execution record, and fire-and-forget the handler.
     * Returns immediately with an execution ID and poll URL (202 Accepted pattern).
     */
    static async executeAction(
        assetId: string,
        actionSlug: string,
        data: { parameters?: Record<string, unknown>; confirm?: boolean },
    ) {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId }, select: { id: true, name: true, categoryId: true },
        });
        if (!asset) throw new ApiError(404, 'Asset not found');
        if (!asset.categoryId) throw new ApiError(400, 'Asset does not have a dynamic category');

        const actionDefinition = await prisma.assetActionDefinition.findFirst({
            where: { categoryId: asset.categoryId, slug: actionSlug, isVisible: true },
        });
        if (!actionDefinition) throw new ApiError(404, 'Action not found');

        if (actionDefinition.isDestructive && actionDefinition.requiresConfirmation && !data.confirm) {
            throw new ApiError(400, 'Confirmation required for destructive action');
        }

        const execution = await prisma.assetActionExecution.create({
            data: {
                assetId, actionDefinitionId: actionDefinition.id,
                status: 'PENDING', parameters: (data.parameters || {}) as Prisma.InputJsonValue, startedAt: new Date(),
            },
        });

        // Dispatch async — import lazily to avoid circular deps
        const { executeAction } = await import('@/lib/action-handlers');
        // executeAction arg type is a union of all action definition shapes — cast at boundary only
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        executeAction(actionDefinition as any, asset, data.parameters || {}, execution.id)
            .then(async (result) => {
                await prisma.assetActionExecution.update({
                    where: { id: execution.id },
                    data: {
                        status: result.status, result: result.output as Prisma.InputJsonValue,
                        errorMessage: result.error, completedAt: result.status === 'COMPLETED' ? new Date() : null,
                    },
                });
            })
            .catch(async (error: unknown) => {
                const message = error instanceof Error ? error.message : 'Unknown execution error';
                await prisma.assetActionExecution.update({
                    where: { id: execution.id },
                    data: { status: 'FAILED', errorMessage: message, completedAt: new Date() },
                }).catch(() => { /* best-effort */ });
            });

        return {
            execution: { id: execution.id, status: execution.status, startedAt: execution.startedAt },
            message: 'Action execution started',
            pollUrl: `/api/executions/${execution.id}`,
        };
    }

    /**
     * Poll the status of an asset action execution by ID.
     * Joins asset name and action definition name/label/type for the response.
     */
    static async getExecution(executionId: string) {
        const execution = await prisma.assetActionExecution.findUnique({
            where: { id: executionId },
            include: {
                asset: { select: { id: true, name: true } },
                actionDefinition: { select: { name: true, label: true, actionType: true } },
            },
        });
        if (!execution) throw new ApiError(404, 'Execution not found');
        return execution;
    }
}
