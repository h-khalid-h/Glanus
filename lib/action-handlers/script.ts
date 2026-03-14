import type { ActionDefinition, ActionAsset, ActionResult, ScriptHandlerConfig } from './types';

/**
 * Script Handler - Executes a local script with security validation,
 * parameter substitution, environment sandboxing, timeout, and output size limits.
 */
export async function handleScriptAction(
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
        } = await import('../script-security');

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
