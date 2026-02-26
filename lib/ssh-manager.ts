import { NodeSSH } from 'node-ssh';
import fs from 'fs/promises';
import path from 'path';

/**
 * SSH configuration for remote command execution
 */
export interface SSHConfig {
    host: string;
    port: number;
    username: string;
    authMethod: 'password' | 'privateKey';
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
    timeout?: number;
}

/**
 * SSH connection pool configuration
 */
interface ConnectionPoolConfig {
    allowedHosts: string[];
    defaultTimeout: number;
    sshKeysPath: string;
}

/**
 * Default SSH configuration
 */
const DEFAULT_CONFIG: ConnectionPoolConfig = {
    allowedHosts: [], // Empty by default - must be explicitly configured
    defaultTimeout: 60, // 1 minute
    sshKeysPath: process.env.GLANUS_SSH_KEYS_PATH || '/etc/glanus/ssh-keys',
};

/**
 * Simple SSH connection pool
 */
class SSHConnectionPool {
    private connections: Map<string, { ssh: NodeSSH; lastUsed: number }> = new Map();
    private config: ConnectionPoolConfig;

    constructor(config: ConnectionPoolConfig = DEFAULT_CONFIG) {
        this.config = config;
    }

    /**
     * Get connection key for pooling
     */
    private getConnectionKey(host: string, port: number, username: string): string {
        return `${username}@${host}:${port}`;
    }

    /**
     * Get or create SSH connection
     */
    async getConnection(sshConfig: SSHConfig): Promise<NodeSSH> {
        const key = this.getConnectionKey(sshConfig.host, sshConfig.port, sshConfig.username);

        // Check if we have a cached connection
        const cached = this.connections.get(key);
        if (cached) {
            // Check if connection is still alive
            try {
                await cached.ssh.execCommand('echo test');
                cached.lastUsed = Date.now();
                return cached.ssh;
            } catch {
                // Connection is dead, remove it
                this.connections.delete(key);
            }
        }

        // Create new connection
        const ssh = await this.createConnection(sshConfig);
        this.connections.set(key, {
            ssh,
            lastUsed: Date.now(),
        });

        return ssh;
    }

    /**
     * Create new SSH connection
     */
    private async createConnection(sshConfig: SSHConfig): Promise<NodeSSH> {
        const ssh = new NodeSSH();

        const connectConfig: {
            host: string;
            port: number;
            username: string;
            password?: string;
            privateKey?: string;
            passphrase?: string;
        } = {
            host: sshConfig.host,
            port: sshConfig.port,
            username: sshConfig.username,
        };

        if (sshConfig.authMethod === 'password') {
            if (!sshConfig.password) {
                throw new Error('Password authentication requires a password');
            }
            connectConfig.password = sshConfig.password;
        } else if (sshConfig.authMethod === 'privateKey') {
            if (!sshConfig.privateKeyPath) {
                throw new Error('Private key authentication requires a key path');
            }

            // Read private key
            const privateKey = await fs.readFile(sshConfig.privateKeyPath, 'utf8');
            connectConfig.privateKey = privateKey;

            if (sshConfig.passphrase) {
                connectConfig.passphrase = sshConfig.passphrase;
            }
        }

        await ssh.connect(connectConfig);
        return ssh;
    }

    /**
     * Close a specific connection
     */
    async closeConnection(host: string, port: number, username: string): Promise<void> {
        const key = this.getConnectionKey(host, port, username);
        const connection = this.connections.get(key);

        if (connection) {
            connection.ssh.dispose();
            this.connections.delete(key);
        }
    }

    /**
     * Close all connections
     */
    async closeAll(): Promise<void> {
        for (const [key, connection] of this.connections.entries()) {
            connection.ssh.dispose();
            this.connections.delete(key);
        }
    }

    /**
     * Clean up old connections (older than 5 minutes)
     */
    async cleanup(maxAge: number = 5 * 60 * 1000): Promise<void> {
        const now = Date.now();
        const toRemove: string[] = [];

        for (const [key, connection] of this.connections.entries()) {
            if (now - connection.lastUsed > maxAge) {
                connection.ssh.dispose();
                toRemove.push(key);
            }
        }

        toRemove.forEach((key) => this.connections.delete(key));
    }
}

/**
 * Global connection pool instance
 */
let connectionPool: SSHConnectionPool | null = null;

/**
 * Get or create connection pool
 */
export function getConnectionPool(config?: ConnectionPoolConfig): SSHConnectionPool {
    if (!connectionPool) {
        connectionPool = new SSHConnectionPool(config);
    }
    return connectionPool;
}

/**
 * Validate host against whitelist
 */
export function validateHost(
    host: string,
    allowedHosts: string[] = DEFAULT_CONFIG.allowedHosts
): { valid: boolean; error?: string } {
    // If no hosts are configured, reject all (fail secure)
    if (allowedHosts.length === 0) {
        return {
            valid: false,
            error: 'No allowed hosts configured. Please configure allowed hosts before using remote commands.',
        };
    }

    // Check if host matches any allowed host (exact match or wildcard)
    const isAllowed = allowedHosts.some((allowedHost) => {
        if (allowedHost === host) {
            return true;
        }

        // Support wildcards like *.example.com
        if (allowedHost.startsWith('*.')) {
            const domain = allowedHost.substring(2);
            return host.endsWith(domain);
        }

        return false;
    });

    if (!isAllowed) {
        return {
            valid: false,
            error: `Host "${host}" is not in the allowed hosts list: ${allowedHosts.join(', ')}`,
        };
    }

    return { valid: true };
}

/**
 * Substitute parameters in command template
 */
export function substituteCommandParameters(
    command: string,
    context: {
        assetId: string;
        assetName?: string;
        parameters: Record<string, unknown>;
    }
): string {
    let result = command;

    // Replace {assetId}
    result = result.replace(/{assetId}/g, shellEscape(context.assetId));

    // Replace {assetName}
    if (context.assetName) {
        result = result.replace(/{assetName}/g, shellEscape(context.assetName));
    }

    // Replace {param:key} with parameter values
    result = result.replace(/{param:(\w+)}/g, (match, key) => {
        return shellEscape(context.parameters[key]?.toString() || '');
    });

    // Replace {key} for direct parameter access
    Object.entries(context.parameters).forEach(([key, value]) => {
        const placeholder = new RegExp(`{${key}}`, 'g');
        result = result.replace(placeholder, shellEscape(value?.toString() || ''));
    });

    return result;
}

/**
 * Shell escape string to prevent command injection
 */
function shellEscape(str: string): string {
    // Escape single quotes by replacing ' with '\''
    return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Execute command on remote host
 */
export async function executeRemoteCommand(
    sshConfig: SSHConfig,
    command: string,
    timeout: number = DEFAULT_CONFIG.defaultTimeout
): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal?: string;
}> {
    const pool = getConnectionPool();
    const ssh = await pool.getConnection(sshConfig);

    // Execute command with timeout
    const result = await Promise.race([
        ssh.execCommand(command),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Command execution timeout')), timeout * 1000)
        ),
    ]);

    return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.code,
        signal: result.signal ?? undefined,
    };
}

/**
 * Get default SSH configuration
 */
export function getDefaultSSHConfig(): ConnectionPoolConfig {
    return { ...DEFAULT_CONFIG };
}

/**
 * Export connection pool for cleanup
 */
export { SSHConnectionPool };
