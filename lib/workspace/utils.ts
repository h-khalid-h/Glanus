import { prisma } from '@/lib/db';
import { WorkspaceRole } from '@prisma/client';

/**
 * Check if a user has the required permission level in a workspace
 */
export async function hasWorkspacePermission(
    userId: string,
    workspaceId: string,
    requiredRole: WorkspaceRole
): Promise<boolean> {
    // Get workspace and membership
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true },
    });

    if (!workspace) {
        return false;
    }

    // Owner always has permissions
    if (workspace.ownerId === userId) {
        return true;
    }

    // Check membership
    const membership = await prisma.workspaceMember.findUnique({
        where: {
            workspaceId_userId: {
                workspaceId,
                userId,
            },
        },
        select: { role: true },
    });

    if (!membership) {
        return false;
    }

    // Role hierarchy
    const roleHierarchy: Record<WorkspaceRole, number> = {
        OWNER: 4,
        ADMIN: 3,
        MEMBER: 2,
        VIEWER: 1,
    };

    return roleHierarchy[membership.role] >= roleHierarchy[requiredRole];
}

/**
 * Get user's role in a workspace
 */
export async function getUserWorkspaceRole(
    userId: string,
    workspaceId: string
): Promise<WorkspaceRole | null> {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true },
    });

    if (!workspace) {
        return null;
    }

    if (workspace.ownerId === userId) {
        return 'OWNER';
    }

    const membership = await prisma.workspaceMember.findUnique({
        where: {
            workspaceId_userId: {
                workspaceId,
                userId,
            },
        },
        select: { role: true },
    });

    return membership?.role || null;
}

/**
 * Check if workspace can perform action based on quota
 */
export async function canPerformAction(
    workspaceId: string,
    action: 'CREATE_ASSET' | 'USE_AI_CREDIT' | 'UPLOAD_FILE',
    amount: number = 1
): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await prisma.subscription.findUnique({
        where: { workspaceId },
        include: {
            workspace: {
                include: {
                    _count: {
                        select: {
                            assets: true,
                        },
                    },
                },
            },
        },
    });

    if (!subscription) {
        return { allowed: false, reason: 'No subscription found' };
    }

    switch (action) {
        case 'CREATE_ASSET':
            const currentAssets = subscription.workspace._count.assets;
            if (currentAssets + amount > subscription.maxAssets) {
                return {
                    allowed: false,
                    reason: `Asset limit reached (${subscription.maxAssets}). Upgrade to add more assets.`,
                };
            }
            return { allowed: true };

        case 'USE_AI_CREDIT':
            if (subscription.aiCreditsUsed + amount > subscription.maxAICreditsPerMonth) {
                return {
                    allowed: false,
                    reason: `AI credit limit reached (${subscription.maxAICreditsPerMonth}/month). Upgrade for more credits.`,
                };
            }
            return { allowed: true };

        case 'UPLOAD_FILE':
            // For file uploads, 'amount' is size in MB
            if (subscription.storageUsedMB + amount > subscription.maxStorageMB) {
                return {
                    allowed: false,
                    reason: `Storage limit reached (${subscription.maxStorageMB} MB). Upgrade for more storage.`,
                };
            }
            return { allowed: true };

        default:
            return { allowed: false, reason: 'Unknown action' };
    }
}

/**
 * Increment usage counter for tracking
 */
export async function incrementUsage(
    workspaceId: string,
    type: 'AI_CREDITS' | 'STORAGE_MB',
    amount: number
): Promise<void> {
    await prisma.subscription.update({
        where: { workspaceId },
        data: {
            ...(type === 'AI_CREDITS' && {
                aiCreditsUsed: { increment: amount },
            }),
            ...(type === 'STORAGE_MB' && {
                storageUsedMB: { increment: amount },
            }),
        },
    });
}

/**
 * Get plan limits for a subscription plan
 */
export function getPlanLimits(plan: string) {
    const limits = {
        FREE: {
            maxAssets: 5,
            maxAICreditsPerMonth: 100,
            maxStorageMB: 1024, // 1 GB
            features: ['Basic asset management', 'Community support'],
        },
        PERSONAL: {
            maxAssets: 50,
            maxAICreditsPerMonth: 1000,
            maxStorageMB: 10240, // 10 GB
            features: [
                'Advanced asset management',
                'Partner support',
                'Basic automation',
                'Email notifications',
            ],
        },
        TEAM: {
            maxAssets: 200,
            maxAICreditsPerMonth: 5000,
            maxStorageMB: 51200, // 50 GB
            features: [
                'All Personal features',
                'Team collaboration',
                'Advanced automation',
                'Custom integrations',
                'Priority support',
            ],
        },
        ENTERPRISE: {
            maxAssets: 999999, // Unlimited
            maxAICreditsPerMonth: 999999,
            maxStorageMB: 999999,
            features: [
                'All Team features',
                'Unlimited assets',
                'White-label options',
                'SSO/SAML',
                'Dedicated support',
                'Custom SLA',
            ],
        },
    };

    return limits[plan as keyof typeof limits] || limits.FREE;
}

/**
 * Verify workspace exists and user has access
 */
export async function verifyWorkspaceAccess(
    userId: string,
    workspaceId: string
): Promise<{ hasAccess: boolean; workspace?: Awaited<ReturnType<typeof prisma.workspace.findUnique>> }> {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
            subscription: true,
        },
    });

    if (!workspace) {
        return { hasAccess: false };
    }

    // Check if user is owner or member
    const hasAccess =
        workspace.ownerId === userId ||
        (await prisma.workspaceMember.count({
            where: {
                workspaceId,
                userId,
            },
        })) > 0;

    return { hasAccess, workspace: hasAccess ? workspace : undefined };
}
