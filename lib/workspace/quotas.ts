/**
 * Subscription Quota Enforcement
 * 
 * Validates workspace resource usage against subscription plan limits.
 * Call before resource-creating operations to enforce plan boundaries.
 */

import { prisma } from '@/lib/db';

export class QuotaExceededError extends Error {
    public statusCode = 403;
    public resource: string;
    public limit: number;
    public current: number;

    constructor(resource: string, limit: number, current: number) {
        super(`Quota exceeded for ${resource}: ${current}/${limit}. Upgrade your plan.`);
        this.name = 'QuotaExceededError';
        this.resource = resource;
        this.limit = limit;
        this.current = current;
    }
}

export type QuotaResource = 'assets' | 'ai_credits' | 'storage_mb';

/**
 * Check if a workspace has remaining quota for a resource.
 * Returns quota info without throwing.
 */
export async function checkQuota(
    workspaceId: string,
    resource: QuotaResource
): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
}> {
    const subscription = await prisma.subscription.findUnique({
        where: { workspaceId },
    });

    if (!subscription) {
        // No subscription = FREE tier defaults
        return { allowed: false, current: 0, limit: 0, remaining: 0 };
    }

    switch (resource) {
        case 'assets': {
            const count = await prisma.asset.count({ where: { workspaceId } });
            return {
                allowed: count < subscription.maxAssets,
                current: count,
                limit: subscription.maxAssets,
                remaining: Math.max(0, subscription.maxAssets - count),
            };
        }
        case 'ai_credits': {
            return {
                allowed: subscription.aiCreditsUsed < subscription.maxAICreditsPerMonth,
                current: subscription.aiCreditsUsed,
                limit: subscription.maxAICreditsPerMonth,
                remaining: Math.max(0, subscription.maxAICreditsPerMonth - subscription.aiCreditsUsed),
            };
        }
        case 'storage_mb': {
            return {
                allowed: subscription.storageUsedMB < subscription.maxStorageMB,
                current: subscription.storageUsedMB,
                limit: subscription.maxStorageMB,
                remaining: Math.max(0, subscription.maxStorageMB - subscription.storageUsedMB),
            };
        }
    }
}

/**
 * Enforce quota — throws QuotaExceededError if limit reached.
 * Use in API routes before creating resources.
 */
export async function enforceQuota(
    workspaceId: string,
    resource: QuotaResource
): Promise<void> {
    const result = await checkQuota(workspaceId, resource);

    if (!result.allowed) {
        throw new QuotaExceededError(resource, result.limit, result.current);
    }
}

/**
 * Increment AI credit usage for a workspace.
 * Call after each AI operation.
 * Uses a conditional update to prevent exceeding maxAICreditsPerMonth.
 */
export async function incrementAICredits(
    workspaceId: string,
    credits: number = 1
): Promise<void> {
    const result = await prisma.$executeRaw`
        UPDATE "Subscription"
        SET "aiCreditsUsed" = "aiCreditsUsed" + ${credits}
        WHERE "workspaceId" = ${workspaceId}
          AND "aiCreditsUsed" + ${credits} <= "maxAICreditsPerMonth"
    `;
    if (result === 0) {
        throw new QuotaExceededError('ai_credits', 0, 0);
    }
}

/**
 * Increment storage usage for a workspace.
 * Call after file uploads.
 */
export async function incrementStorageUsage(
    workspaceId: string,
    sizeMB: number
): Promise<void> {
    await prisma.subscription.update({
        where: { workspaceId },
        data: {
            storageUsedMB: { increment: Math.ceil(sizeMB) },
        },
    });
}
