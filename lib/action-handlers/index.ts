/**
 * Action Handler Dispatcher
 *
 * Routes action execution to the appropriate handler based on HandlerType.
 * Each handler is self-contained in its own module — add new handler types
 * by creating a new file here and adding a case to the switch below.
 *
 * Extension point:
 *   1. Create `lib/action-handlers/[new-type].ts` implementing the handler function
 *   2. Import it here and add its HandlerType case to the switch statement
 */

import type { ActionDefinition, ActionAsset, ActionResult } from './types';
import { handleApiAction } from './api';
import { handleScriptAction } from './script';
import { handleWebhookAction } from './webhook';
import { handleRemoteCommandAction } from './remote-command';
import { handleManualAction } from './manual';

export type { ActionDefinition, ActionAsset, ActionResult } from './types';

/**
 * Action handler factory - dispatches action execution to the appropriate handler.
 */
export async function executeAction(
    actionDefinition: ActionDefinition,
    asset: ActionAsset,
    parameters: Record<string, unknown>,
    _executionId: string
): Promise<ActionResult> {
    try {
        switch (actionDefinition.handlerType) {
            case 'API':
                return await handleApiAction(actionDefinition, asset, parameters);

            case 'SCRIPT':
                return await handleScriptAction(actionDefinition, asset, parameters);

            case 'WEBHOOK':
                return await handleWebhookAction(actionDefinition, asset, parameters);

            case 'REMOTE_COMMAND':
                return await handleRemoteCommandAction(actionDefinition, asset, parameters);

            case 'MANUAL':
                return await handleManualAction(actionDefinition, asset, parameters);

            default:
                return {
                    status: 'FAILED',
                    error: `Unknown handler type: ${actionDefinition.handlerType}`,
                };
        }
    } catch (error: unknown) {
        return {
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Action execution failed',
        };
    }
}
