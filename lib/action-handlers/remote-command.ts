import type { SSHConfig } from '../ssh-manager';
import type { ActionDefinition, ActionAsset, ActionResult, RemoteCommandConfig } from './types';

/**
 * Remote Command Handler - Executes a command on a remote server via SSH
 * with host validation, parameter substitution, and configurable auth (password/privateKey).
 */
export async function handleRemoteCommandAction(
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
        } = await import('../ssh-manager');

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
