import { logError } from '@/lib/logger';
/**
 * Enhanced Security Audit Logging
 * 
 * Logs security-sensitive events with risk assessment and metadata.
 */

import { prisma } from '@/lib/db';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityAuditData {
    action: string;
    resourceType?: string;
    resourceId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
    riskLevel?: RiskLevel;
    metadata?: Record<string, unknown>;
}

/**
 * Log a security event to audit trail
 */
export async function logSecurityEvent(data: SecurityAuditData): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                action: data.action,
                resourceType: data.resourceType || 'Security',
                resourceId: data.resourceId || 'N/A',
                userId: data.userId,
                metadata: {
                    ...data.metadata,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    success: data.success,
                    errorMessage: data.errorMessage,
                    riskLevel: data.riskLevel || 'LOW',
                    timestamp: new Date().toISOString(),
                },
            },
        });
    } catch (error: unknown) {
        // Fail silently - don't break the request if audit logging fails
        logError('Failed to log security event', error);
    }
}

/**
 * Log failed login attempt
 */
export async function logFailedLogin(
    email: string,
    ipAddress: string,
    userAgent: string,
    reason: string
): Promise<void> {
    await logSecurityEvent({
        action: 'LOGIN_FAILED',
        metadata: { email, reason },
        ipAddress,
        userAgent,
        success: false,
        errorMessage: reason,
        riskLevel: 'MEDIUM',
    });
}

/**
 * Log successful login
 */
export async function logSuccessfulLogin(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent: string
): Promise<void> {
    await logSecurityEvent({
        action: 'LOGIN_SUCCESS',
        userId,
        metadata: { email },
        ipAddress,
        userAgent,
        success: true,
        riskLevel: 'LOW',
    });
}

/**
 * Log account lockout
 */
export async function logAccountLockout(
    email: string,
    ipAddress: string,
    attempts: number
): Promise<void> {
    await logSecurityEvent({
        action: 'ACCOUNT_LOCKED',
        metadata: { email, attempts },
        ipAddress,
        success: false,
        riskLevel: 'HIGH',
    });
}

/**
 * Log rate limit violation
 */
export async function logRateLimitViolation(
    ipAddress: string,
    endpoint: string,
    limitType: string
): Promise<void> {
    await logSecurityEvent({
        action: 'RATE_LIMIT_EXCEEDED',
        metadata: { endpoint, limitType },
        ipAddress,
        success: false,
        riskLevel: 'MEDIUM',
    });
}

/**
 * Log CSRF validation failure
 */
export async function logCSRFFailure(
    ipAddress: string,
    userAgent: string,
    endpoint: string
): Promise<void> {
    await logSecurityEvent({
        action: 'CSRF_VALIDATION_FAILED',
        metadata: { endpoint },
        ipAddress,
        userAgent,
        success: false,
        riskLevel: 'HIGH',
    });
}

/**
 * Log privilege escalation attempt
 */
export async function logPrivilegeEscalation(
    userId: string,
    action: string,
    ipAddress: string
): Promise<void> {
    await logSecurityEvent({
        action: 'PRIVILEGE_ESCALATION_ATTEMPT',
        userId,
        metadata: { attemptedAction: action },
        ipAddress,
        success: false,
        riskLevel: 'CRITICAL',
    });
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
    description: string,
    ipAddress: string,
    metadata?: Record<string, any>
): Promise<void> {
    await logSecurityEvent({
        action: 'SUSPICIOUS_ACTIVITY',
        metadata: { description, ...metadata },
        ipAddress,
        success: false,
        riskLevel: 'HIGH',
    });
}
