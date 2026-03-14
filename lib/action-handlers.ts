/**
 * @deprecated This barrel file exists for backward compatibility.
 * The implementation has been modularized into `lib/action-handlers/`.
 *
 * Import from `@/lib/action-handlers` continues to work unchanged.
 * To add a new handler type, see `lib/action-handlers/index.ts`.
 */
export { executeAction } from './action-handlers/index';
export type { ActionDefinition, ActionAsset, ActionResult } from './action-handlers/types';
