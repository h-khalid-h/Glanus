/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at startup.
 * Called from instrumentation.ts register() to fail fast on missing config.
 */
import { logWarn } from '@/lib/logger';

const requiredEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
] as const;

const productionRequiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'CSRF_SECRET',
    'CRON_SECRET',
] as const;

const productionRecommendedEnvVars = [
    'REDIS_URL',
    'SENTRY_DSN',
] as const;

interface EnvValidationResult {
    valid: boolean;
    missing: string[];
    warnings: string[];
}

export function validateEnv(): EnvValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required vars
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // Check production-required vars
    for (const envVar of productionRequiredEnvVars) {
        if (!process.env[envVar]) {
            if (isProduction) {
                missing.push(envVar);
            } else {
                warnings.push(`${envVar} not set (required in production)`);
            }
        }
    }

    // Check production-recommended vars (warn but don't block startup)
    if (isProduction) {
        for (const envVar of productionRecommendedEnvVars) {
            if (!process.env[envVar]) {
                warnings.push(`${envVar} not set — recommended for production (rate limiting uses in-memory fallback without Redis)`);
            }
        }
    }

    // Validate CSRF_SECRET length
    const csrfSecret = process.env.CSRF_SECRET;
    if (csrfSecret && csrfSecret.length < 32) {
        warnings.push('CSRF_SECRET should be at least 32 characters');
    }

    // Validate CRON_SECRET length
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && cronSecret.length < 16) {
        warnings.push('CRON_SECRET should be at least 16 characters');
    }

    // Validate NEXTAUTH_SECRET is not the default
    if (process.env.NEXTAUTH_SECRET === 'your-secret-key-here-change-in-production') {
        if (isProduction) {
            missing.push('NEXTAUTH_SECRET (using default value)');
        } else {
            warnings.push('NEXTAUTH_SECRET is using the default insecure value');
        }
    }

    // Validate DATABASE_URL format
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
        warnings.push('DATABASE_URL does not look like a PostgreSQL connection string');
    }

    return {
        valid: missing.length === 0,
        missing,
        warnings,
    };
}

/**
 * Run env validation and throw if critical vars missing.
 * Called at startup from instrumentation.ts register().
 */
export function assertEnvValid(): void {
    const result = validateEnv();

    if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
            logWarn(`ENV WARNING: ${warning}`);
        }
    }

    if (!result.valid) {
        const errorMessage = `Missing required environment variables:\n${result.missing.map(v => `  - ${v}`).join('\n')}`;
        throw new Error(errorMessage);
    }
}
