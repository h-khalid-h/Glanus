/**
 * Input Sanitization Utilities
 * 
 * Prevents XSS, SQL injection, path traversal, and command injection attacks.
 */

import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHTML(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'title'],
    });
}

/**
 * Sanitize plain text (escape HTML entities)
 */
export function sanitizeText(text: string): string {
    return validator.escape(text);
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string | null {
    const trimmed = email.trim().toLowerCase();
    return validator.isEmail(trimmed) ? trimmed : null;
}

/**
 * Sanitize URL
 */
export function sanitizeURL(url: string): string | null {
    if (!validator.isURL(url, {
        protocols: ['http', 'https'],
        require_protocol: true,
    })) {
        return null;
    }

    return url;
}

/**
 * Prevent path traversal attacks
 */
export function sanitizePath(path: string): string | null {
    // Check for suspicious patterns BEFORE removing
    if (path.includes('../') || path.includes('..\\')) {
        return null;
    }

    // Remove leading slashes
    const cleaned = path.replace(/^\/+/, '');

    return cleaned;
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
    // Remove path separators and special characters
    return filename
        .replace(/[/\\]/g, '')
        .replace(/[<>:"|?*]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 255); // Limit length
}

/**
 * Validate and sanitize SSH command
 * Only allows whitelisted commands
 */
const ALLOWED_SSH_COMMANDS = [
    'ls',
    'pwd',
    'whoami',
    'hostname',
    'uptime',
    'df',
    'free',
    'top',
    'ps',
];

export function sanitizeSSHCommand(command: string): string | null {
    const trimmed = command.trim();

    // Reject excessively long commands
    if (trimmed.length > 200) return null;

    // Extract the base command (first word)
    const parts = trimmed.split(/\s+/);
    const baseCommand = parts[0];

    // Check if command is whitelisted
    if (!ALLOWED_SSH_COMMANDS.includes(baseCommand)) {
        return null;
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
        /[;&|`$()]/,  // Command chaining
        /\.\./,        // Path traversal
        />/,           // Redirection
        /</,           // Input redirection
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(trimmed)) {
            return null;
        }
    }

    // Block arguments that start with / to prevent reading sensitive paths
    const args = parts.slice(1);
    for (const arg of args) {
        if (arg.startsWith('/etc') || arg.startsWith('/proc') || arg.startsWith('/sys') ||
            arg.startsWith('/root') || arg.startsWith('/var/log')) {
            return null;
        }
    }

    // Limit number of arguments to prevent abuse
    if (args.length > 5) return null;

    return trimmed;
}

/**
 * Sanitize JSON object (deep sanitization)
 */
export function sanitizeJSON(obj: unknown): unknown {
    if (typeof obj === 'string') {
        return sanitizeText(obj);
    }

    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeJSON(item));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        // Sanitize key
        const cleanKey = sanitizeText(key);
        // Recursively sanitize value
        sanitized[cleanKey] = sanitizeJSON(value);
    }

    return sanitized;
}

/**
 * Validate password strength
 */
export interface PasswordValidation {
    valid: boolean;
    errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    // Check for common passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
        errors.push('Password is too common');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Sanitize user input object (for API requests)
 */
export function sanitizeInput(input: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string') {
            // Check if it looks like HTML
            if (/<[a-z][\s\S]*>/i.test(value)) {
                sanitized[key] = sanitizeHTML(value);
            } else {
                sanitized[key] = sanitizeText(value);
            }
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeJSON(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}
