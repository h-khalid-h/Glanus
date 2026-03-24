import path from 'path';
import fs from 'fs/promises';

/**
 * Script execution security configuration
 */
export interface ScriptSecurityConfig {
    allowedDirectories: string[];
    allowedInterpreters: string[];
    defaultTimeout: number; // seconds
    maxOutputSize: number; // bytes
}

/**
 * Default security configuration for script execution
 */
const DEFAULT_CONFIG: ScriptSecurityConfig = {
    allowedDirectories: [
        '/opt/glanus/scripts',
        '/var/lib/glanus/scripts',
        path.join(process.cwd(), 'scripts'), // Allow ./scripts in project root
    ],
    allowedInterpreters: ['bash', 'sh', 'python3', 'python', 'node'],
    defaultTimeout: 300, // 5 minutes
    maxOutputSize: 1048576, // 1 MB
};

/**
 * Validate that a script path is safe to execute
 */
export async function validateScriptPath(
    scriptPath: string,
    config: ScriptSecurityConfig = DEFAULT_CONFIG
): Promise<{ valid: boolean; error?: string; resolvedPath?: string }> {
    try {
        // Check for path traversal attempts before resolution
        if (scriptPath.includes('..')) {
            return {
                valid: false,
                error: 'Path traversal detected - script path cannot contain ".."',
            };
        }

        // Resolve to absolute path
        const resolvedPath = path.resolve(scriptPath);

        // Check if file exists before realpath (realpath requires the file to exist)
        try {
            await fs.access(resolvedPath, fs.constants.F_OK);
        } catch {
            return {
                valid: false,
                error: `Script file does not exist: ${resolvedPath}`,
            };
        }

        // Resolve symlinks to get the true filesystem path, preventing
        // symlink-based escapes from allowed directories
        const realPath = await fs.realpath(resolvedPath);

        // Check if the real path (after resolving symlinks) is within allowed directories
        const isAllowed = config.allowedDirectories.some((allowedDir) => {
            const resolvedAllowedDir = path.resolve(allowedDir);
            return realPath.startsWith(resolvedAllowedDir + path.sep) || realPath === resolvedAllowedDir;
        });

        if (!isAllowed) {
            return {
                valid: false,
                error: `Script must be in one of the allowed directories: ${config.allowedDirectories.join(', ')}`,
            };
        }

        // Check if file is executable (on Unix systems)
        if (process.platform !== 'win32') {
            try {
                await fs.access(realPath, fs.constants.X_OK);
            } catch {
                // Not executable, but we can still run it with an interpreter
                // This is not necessarily an error
            }
        }

        return {
            valid: true,
            resolvedPath: realPath,
        };
    } catch (error: unknown) {
        return {
            valid: false,
            error: `Path validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Validate interpreter
 */
export function validateInterpreter(
    interpreter: string | undefined,
    config: ScriptSecurityConfig = DEFAULT_CONFIG
): { valid: boolean; error?: string } {
    if (!interpreter) {
        return { valid: true }; // No interpreter specified, will use script's shebang
    }

    if (!config.allowedInterpreters.includes(interpreter)) {
        return {
            valid: false,
            error: `Interpreter "${interpreter}" is not allowed. Allowed: ${config.allowedInterpreters.join(', ')}`,
        };
    }

    return { valid: true };
}

/**
 * Substitute placeholders in arguments with actual values
 * Supports: {assetId}, {assetName}, {param:key}, etc.
 */
export function substituteParameters(
    args: string[],
    context: {
        assetId: string;
        assetName?: string;
        parameters: Record<string, unknown>;
    }
): string[] {
    return args.map((arg) => {
        let result = arg;

        // Replace {assetId}
        result = result.replace(/{assetId}/g, context.assetId);

        // Replace {assetName}
        if (context.assetName) {
            result = result.replace(/{assetName}/g, context.assetName);
        }

        // Replace {param:key} with parameter values
        result = result.replace(/{param:(\w+)}/g, (match, key) => {
            return context.parameters[key]?.toString() || '';
        });

        // Replace {key} for direct parameter access
        Object.entries(context.parameters).forEach(([key, value]) => {
            const placeholder = new RegExp(`{${key}}`, 'g');
            result = result.replace(placeholder, value?.toString() || '');
        });

        return result;
    });
}

/**
 * Sanitize environment variables
 */
export function sanitizeEnvironment(
    env: Record<string, string> | undefined
): Record<string, string> {
    if (!env) {
        return {};
    }

    const sanitized: Record<string, string> = {};

    // Only allow specific safe environment variables
    const allowedKeys = [
        'PATH',
        'HOME',
        'USER',
        'LANG',
        'LC_ALL',
        // Custom Glanus variables
        'GLANUS_ASSET_ID',
        'GLANUS_ACTION_ID',
        'GLANUS_EXECUTION_ID',
    ];

    Object.entries(env).forEach(([key, value]) => {
        if (allowedKeys.includes(key)) {
            sanitized[key] = value;
        }
    });

    return sanitized;
}

/**
 * Validate output size to prevent memory exhaustion
 */
export function isOutputSizeExceeded(
    currentSize: number,
    maxSize: number = DEFAULT_CONFIG.maxOutputSize
): boolean {
    return currentSize > maxSize;
}

/**
 * Get default security configuration
 */
export function getDefaultSecurityConfig(): ScriptSecurityConfig {
    return { ...DEFAULT_CONFIG };
}

/**
 * Export default config
 */
export const scriptSecurityConfig = DEFAULT_CONFIG;
