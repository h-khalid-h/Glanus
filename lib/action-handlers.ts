import { ExecutionStatus, HandlerType } from '@prisma/client';
import type { SSHConfig } from './ssh-manager';

/** Shared types for action handler dispatch */
interface ActionDefinition {
    id: string;
    name: string;
    handlerType: HandlerType;
    handlerConfig: Record<string, unknown> | null;
}

interface ActionAsset {
    id: string;
    name: string;
}

interface ActionResult {
    status: ExecutionStatus;
    output?: unknown;
    error?: string;
}

/** Per-handler configuration shapes */
interface ApiHandlerConfig {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
}

interface ScriptHandlerConfig {
    scriptPath?: string;
    interpreter?: string;
    args?: string[];
    workingDirectory?: string;
    timeout?: number;
    env?: Record<string, string>;
}

interface WebhookHandlerConfig {
    webhookUrl?: string;
    secret?: string;
}

interface RemoteCommandConfig {
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

interface ManualHandlerConfig {
    instructions?: string;
}

/**
 * Action handler factory - dispatches action execution to appropriate handler
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

/**
 * API Handler - Makes HTTP request to external API
 */
async function handleApiAction(
    actionDefinition: ActionDefinition,
    asset: ActionAsset,
    parameters: Record<string, unknown>
): Promise<ActionResult> {
    const config = (actionDefinition.handlerConfig || {}) as ApiHandlerConfig;
    const { url, method = 'POST', headers = {} } = config;

    if (!url) {
        return { status: 'FAILED', error: 'API handler missing URL configuration' };
    }

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            body: JSON.stringify({
                action: actionDefinition.name,
                asset: {
                    id: asset.id,
                    name: asset.name,
                },
                parameters,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                status: 'FAILED',
                error: `API request failed: ${response.status}`,
                output: data,
            };
        }

        return {
            status: 'COMPLETED',
            output: data,
        };
    } catch (error: unknown) {
        return {
            status: 'FAILED',
            error: `API request error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Script Handler - Executes local script
 */
async function handleScriptAction(
    actionDefinition: ActionDefinition,
    asset: ActionAsset,
    parameters: Record<string, unknown>
): Promise<ActionResult> {
    const config = (actionDefinition.handlerConfig || {}) as ScriptHandlerConfig;
    const {
        scriptPath,
        interpreter,
        args = [],
        workingDirectory,
        timeout = 300, // 5 minutes default
        env = {},
    } = config;

    if (!scriptPath) {
        return { status: 'FAILED', error: 'Script handler missing scriptPath configuration' };
    }

    try {
        const {
            validateScriptPath,
            validateInterpreter,
            substituteParameters,
            sanitizeEnvironment,
            isOutputSizeExceeded,
            getDefaultSecurityConfig,
        } = await import('./script-security');

        const securityConfig = getDefaultSecurityConfig();

        // Validate script path
        const pathValidation = await validateScriptPath(scriptPath, securityConfig);
        if (!pathValidation.valid) {
            return {
                status: 'FAILED',
                error: `Script validation failed: ${pathValidation.error}`,
            };
        }

        // Validate interpreter
        const interpreterValidation = validateInterpreter(interpreter, securityConfig);
        if (!interpreterValidation.valid) {
            return {
                status: 'FAILED',
                error: `Interpreter validation failed: ${interpreterValidation.error}`,
            };
        }

        // Prepare execution
        const { spawn } = await import('child_process');
        const resolvedPath = pathValidation.resolvedPath!;

        // Substitute parameters in args
        const substitutedArgs = substituteParameters(args, {
            assetId: asset.id,
            assetName: asset.name,
            parameters: parameters as Record<string, unknown>,
        });

        // Prepare environment
        const sanitizedEnv = sanitizeEnvironment({
            ...process.env,
            ...env,
            GLANUS_ASSET_ID: asset.id,
            GLANUS_ASSET_NAME: asset.name,
            GLANUS_ACTION_ID: actionDefinition.id,
            GLANUS_ACTION_NAME: actionDefinition.name,
        } as Record<string, string>);

        // Determine command and args
        let command: string;
        let cmdArgs: string[];

        if (interpreter) {
            command = interpreter;
            cmdArgs = [resolvedPath, ...substitutedArgs];
        } else {
            command = resolvedPath;
            cmdArgs = substitutedArgs;
        }

        // Execute script
        return await new Promise((resolve) => {
            const child = spawn(command, cmdArgs, {
                cwd: workingDirectory || process.cwd(),
                env: sanitizedEnv as NodeJS.ProcessEnv,
            });

            let stdout = '';
            let stderr = '';
            let killed = false;
            let fallbackKillTimeout: NodeJS.Timeout | null = null;

            const executeKillSequence = () => {
                if (killed) return;
                killed = true;
                child.kill('SIGTERM');
                fallbackKillTimeout = setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL'); // Force kill if SIGTERM didn't work
                    }
                }, 5000);
            };

            // Set up timeout
            const timeoutId = setTimeout(() => {
                executeKillSequence();
            }, timeout * 1000);

            // Capture stdout
            child.stdout?.on('data', (data) => {
                const chunk = data.toString();
                if (!isOutputSizeExceeded(stdout.length + chunk.length)) {
                    stdout += chunk;
                } else if (!killed) {
                    clearTimeout(timeoutId);
                    executeKillSequence();
                }
            });

            // Capture stderr
            child.stderr?.on('data', (data) => {
                const chunk = data.toString();
                if (!isOutputSizeExceeded(stderr.length + chunk.length)) {
                    stderr += chunk;
                }
            });

            // Handle process exit
            child.on('close', (code, signal) => {
                clearTimeout(timeoutId);
                if (fallbackKillTimeout) clearTimeout(fallbackKillTimeout);

                if (killed) {
                    resolve({
                        status: 'FAILED',
                        error: 'Script execution timeout exceeded',
                        output: {
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            timeout: true,
                        },
                    });
                } else if (code === 0) {
                    resolve({
                        status: 'COMPLETED',
                        output: {
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            exitCode: code,
                        },
                    });
                } else {
                    resolve({
                        status: 'FAILED',
                        error: `Script exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`,
                        output: {
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            exitCode: code,
                            signal,
                        },
                    });
                }
            });

            // Handle errors
            child.on('error', (error) => {
                clearTimeout(timeoutId);
                resolve({
                    status: 'FAILED',
                    error: `Script execution error: ${error.message}`,
                });
            });
        });
    } catch (error: unknown) {
        return {
            status: 'FAILED',
            error: `Script handler error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Webhook Handler - Sends POST to configured webhook URL
 */
async function handleWebhookAction(
    actionDefinition: ActionDefinition,
    asset: ActionAsset,
    parameters: Record<string, unknown>
): Promise<ActionResult> {
    const config = (actionDefinition.handlerConfig || {}) as WebhookHandlerConfig;
    const { webhookUrl, secret } = config;

    if (!webhookUrl) {
        return { status: 'FAILED', error: 'Webhook handler missing webhookUrl configuration' };
    }

    try {
        const payload = {
            event: 'action.executed',
            action: actionDefinition.name,
            asset: {
                id: asset.id,
                name: asset.name,
            },
            parameters,
            timestamp: new Date().toISOString(),
        };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (secret) {
            // Add HMAC signature for webhook verification
            const crypto = await import('crypto');
            const signature = crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(payload))
                .digest('hex');
            headers['X-Webhook-Signature'] = signature;
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        const data = await response.text();

        if (!response.ok) {
            return {
                status: 'FAILED',
                error: `Webhook failed: ${response.status}`,
                output: data,
            };
        }

        return {
            status: 'COMPLETED',
            output: { webhookResponse: data },
        };
    } catch (error: unknown) {
        return {
            status: 'FAILED',
            error: `Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Remote Command Handler - Executes command on remote server via SSH
 */
async function handleRemoteCommandAction(
    actionDefinition: ActionDefinition,
    asset: ActionAsset,
    parameters: Record<string, unknown>
): Promise<ActionResult> {
    const config = (actionDefinition.handlerConfig || {}) as RemoteCommandConfig;
    const {
        host,
        port = 22,
        username,
        command,
        authMethod = 'privateKey',
        password,
        privateKeyPath,
        passphrase,
        timeout = 60,
    } = config;

    if (!host || !username || !command) {
        return {
            status: 'FAILED',
            error: 'Remote command handler missing required configuration (host, username, command)',
        };
    }

    try {
        const {
            validateHost,
            substituteCommandParameters,
            executeRemoteCommand,
            getDefaultSSHConfig,
        } = await import('./ssh-manager');

        const sshConfig = getDefaultSSHConfig();

        // Validate host
        const hostValidation = validateHost(host, sshConfig.allowedHosts);
        if (!hostValidation.valid) {
            return {
                status: 'FAILED',
                error: `Host validation failed: ${hostValidation.error}`,
            };
        }

        // Substitute parameters in command
        const substitutedCommand = substituteCommandParameters(command, {
            assetId: asset.id,
            assetName: asset.name,
            parameters: parameters as Record<string, unknown>,
        });

        // Prepare SSH connection config
        const connectionConfig: SSHConfig = {
            host,
            port,
            username,
            authMethod,
            timeout,
        };

        if (authMethod === 'password') {
            if (!password) {
                return {
                    status: 'FAILED',
                    error: 'Password authentication requires a password',
                };
            }
            connectionConfig.password = password;
        } else if (authMethod === 'privateKey') {
            if (!privateKeyPath) {
                return {
                    status: 'FAILED',
                    error: 'Private key authentication requires a key path',
                };
            }
            connectionConfig.privateKeyPath = privateKeyPath;
            if (passphrase) {
                connectionConfig.passphrase = passphrase;
            }
        }

        // Execute remote command
        const result = await executeRemoteCommand(connectionConfig, substitutedCommand, timeout);

        if (result.exitCode === 0) {
            return {
                status: 'COMPLETED',
                output: {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: result.exitCode,
                    host,
                },
            };
        } else {
            return {
                status: 'FAILED',
                error: `Remote command exited with code ${result.exitCode}${result.signal ? ` (signal: ${result.signal})` : ''}`,
                output: {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: result.exitCode,
                    signal: result.signal,
                    host,
                },
            };
        }
    } catch (error: unknown) {
        return {
            status: 'FAILED',
            error: `Remote command handler error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Manual Handler -Returns instructions for manual execution
 */
async function handleManualAction(
    actionDefinition: ActionDefinition,
    asset: ActionAsset,
    parameters: Record<string, unknown>
): Promise<ActionResult> {
    const config = (actionDefinition.handlerConfig || {}) as ManualHandlerConfig;
    const { instructions } = config;

    // Manual actions go to PENDING status and require admin to mark complete
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
