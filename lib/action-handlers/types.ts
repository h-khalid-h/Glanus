import { ExecutionStatus, HandlerType } from '@prisma/client';

/** Shared types for action handler dispatch */
export interface ActionDefinition {
    id: string;
    name: string;
    handlerType: HandlerType;
    handlerConfig: Record<string, unknown> | null;
}

export interface ActionAsset {
    id: string;
    name: string;
}

export interface ActionResult {
    status: ExecutionStatus;
    output?: unknown;
    error?: string;
}

/** Per-handler configuration shapes */
export interface ApiHandlerConfig {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
}

export interface ScriptHandlerConfig {
    scriptPath?: string;
    interpreter?: string;
    args?: string[];
    workingDirectory?: string;
    timeout?: number;
    env?: Record<string, string>;
}

export interface WebhookHandlerConfig {
    webhookUrl?: string;
    secret?: string;
}

export interface RemoteCommandConfig {
    host?: string;
    port?: number;
    username?: string;
    command?: string;
    authMethod?: 'password' | 'privateKey';
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
    timeout?: number;
}

export interface ManualHandlerConfig {
    instructions?: string;
}
