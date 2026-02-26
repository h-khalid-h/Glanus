import { logError } from '@/lib/logger';
/**
 * Workspace permission utilities
 * Provides role-based access control for workspace operations
 */
import { prisma } from '@/lib/db';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export type WorkspacePermission =
    | 'manageMembers'
    | 'manageSettings'
    | 'manageBilling'
    | 'manageAssets'
    | 'createAssets'
    | 'deleteAssets'
    | 'viewAssets'
    | 'runScripts'
    | 'viewAnalytics';

/**
 * Permission matrix: role -> allowed permissions
 */
const ROLE_PERMISSIONS: Record<WorkspaceRole, WorkspacePermission[]> = {
    OWNER: [
        'manageMembers', 'manageSettings', 'manageBilling',
        'manageAssets', 'createAssets', 'deleteAssets',
        'viewAssets', 'runScripts', 'viewAnalytics',
    ],
    ADMIN: [
        'manageMembers', 'manageSettings',
        'manageAssets', 'createAssets', 'deleteAssets',
        'viewAssets', 'runScripts', 'viewAnalytics',
    ],
    MEMBER: [
        'createAssets', 'viewAssets', 'runScripts', 'viewAnalytics',
    ],
    VIEWER: [
        'viewAssets', 'viewAnalytics',
    ],
};

/**
 * Check if a role has a specific permission
 */
export function hasWorkspacePermission(
    role: string | undefined | null,
    permission: WorkspacePermission
): boolean {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS[role as WorkspaceRole];
    return permissions ? permissions.includes(permission) : false;
}

/**
 * Verify that a user has access to a workspace and return their role
 */
export async function verifyWorkspaceAccess(
    userEmail: string,
    workspaceId: string
): Promise<{ allowed: boolean; role?: string; error?: string }> {
    try {
        const user = await prisma.user.findUnique({
            where: { email: userEmail },
        });

        if (!user) {
            return { allowed: false, error: 'User not found' };
        }

        // Check if owner
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace) {
            return { allowed: false, error: 'Workspace not found' };
        }

        if (workspace.ownerId === user.id) {
            return { allowed: true, role: 'OWNER' };
        }

        // Check membership
        const membership = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: user.id,
                },
            },
        });

        if (!membership) {
            return { allowed: false, error: 'Access denied' };
        }

        return { allowed: true, role: membership.role };
    } catch (error: unknown) {
        logError('Workspace access verification failed', error);
        return { allowed: false, error: 'Internal error' };
    }
}
