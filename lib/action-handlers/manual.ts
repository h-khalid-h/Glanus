import type { ActionDefinition, ActionAsset, ActionResult, ManualHandlerConfig } from './types';

/**
 * Manual Handler - Returns instructions for human execution.
 * Sets action to PENDING status; admin must mark it complete.
 */
export async function handleManualAction(
    actionDefinition: ActionDefinition,
    asset: ActionAsset,
    parameters: Record<string, unknown>
): Promise<ActionResult> {
    const config = (actionDefinition.handlerConfig || {}) as ManualHandlerConfig;
    const { instructions } = config;

    return {
        status: 'PENDING',
        output: {
            message: 'Manual action requires human intervention',
            instructions: instructions || 'No instructions provided',
            asset: {
                id: asset.id,
                name: asset.name,
            },
            parameters,
        },
    };
}
