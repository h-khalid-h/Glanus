'use client';

/**
 * <Can> — Dynamic permission guard component.
 *
 * Renders children only when the current user has `{resource}.{action}`
 * permission in the active workspace (or platform scope).
 *
 * @example
 *   <Can action="create" resource="users">
 *     <Button>Add User</Button>
 *   </Can>
 *
 *   <Can action="manage" resource="billing" fallback={<UpgradeBanner />}>
 *     <BillingSettings />
 *   </Can>
 *
 *   // Platform-scoped check (no workspace context)
 *   <Can action="read" resource="audit" scope="platform">
 *     <AuditLogViewer />
 *   </Can>
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ShieldAlert } from 'lucide-react';

// ---------------------------------------------------------------------------
// Permission check logic (pure, no network)
// ---------------------------------------------------------------------------

function checkDynamicPermission(
    user: ReturnType<typeof useAuthStore.getState>['user'],
    activeWorkspaceId: string | null,
    resource: string,
    action: string,
    scope?: 'workspace' | 'platform',
    workspaceId?: string | null,
): boolean {
    if (!user) return false;

    // Super admin bypass
    if (user.roles.includes('super_admin')) return true;

    const key = `${resource}.${action}`;
    const manageKey = `${resource}.manage`;

    if (scope === 'platform') {
        // Platform-scoped check
        const perms = user.dynamicPermissions ?? [];
        return perms.includes(key) || (action !== 'manage' && perms.includes(manageKey)) || perms.includes('platform.manage');
    }

    // Workspace-scoped check
    const wid = workspaceId ?? activeWorkspaceId;
    if (!wid) return false;

    const workspace = user.workspaces.find((w) => w.id === wid);
    if (!workspace) return false;

    // Owner override
    if (workspace.ownerId === user.id) return true;

    // Check dynamic permissions first, then legacy
    const dynPerms = workspace.dynamicPermissions ?? [];
    if (dynPerms.includes(key)) return true;
    if (action !== 'manage' && dynPerms.includes(manageKey)) return true;

    // Legacy permission fallback
    const legacyMap: Record<string, string> = {
        'workspace.read': 'view_workspace',
        'analytics.read': 'view_analytics',
        'reports.read': 'view_reports',
        'assets.create': 'create_asset',
        'assets.update': 'edit_asset',
        'assets.delete': 'delete_asset',
        'assets.manage': 'manage_assets',
        'alerts.manage': 'manage_alerts',
        'members.read': 'view_users',
        'members.invite': 'invite_members',
        'members.remove': 'remove_members',
        'workspace.manage': 'manage_workspace',
        'integrations.manage': 'manage_integrations',
        'billing.manage': 'manage_billing',
        'workspace.delete': 'delete_workspace',
    };
    const legacyPerm = legacyMap[key];
    if (legacyPerm && workspace.permissions.includes(legacyPerm)) return true;

    return false;
}

// ---------------------------------------------------------------------------
// Default fallback
// ---------------------------------------------------------------------------

function AccessDeniedCompact() {
    return null; // Silent hide — no UI for inline <Can> guards
}

// ---------------------------------------------------------------------------
// <Can> Component
// ---------------------------------------------------------------------------

interface CanProps {
    /** The action to check (e.g. "create", "read", "update", "delete", "manage") */
    action: string;
    /** The resource to check (e.g. "users", "assets", "billing") */
    resource: string;
    /** Override workspace context for this check */
    workspaceId?: string | null;
    /** Check at platform scope instead of workspace scope */
    scope?: 'workspace' | 'platform';
    /** Node to render when permission check fails. Defaults to null (hidden). */
    fallback?: ReactNode;
    children: ReactNode;
}

export function Can({
    action,
    resource,
    workspaceId,
    scope,
    fallback,
    children,
}: CanProps) {
    const user = useAuthStore((state) => state.user);
    const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);

    const allowed = useMemo(
        () => checkDynamicPermission(user, activeWorkspaceId, resource, action, scope, workspaceId),
        [user, activeWorkspaceId, resource, action, scope, workspaceId],
    );

    if (!allowed) {
        return <>{fallback ?? <AccessDeniedCompact />}</>;
    }

    return <>{children}</>;
}

// ---------------------------------------------------------------------------
// <CanPage> — full-page permission guard with visible "Access Denied" fallback
// ---------------------------------------------------------------------------

function AccessDeniedPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[320px] py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
                You don&apos;t have permission to view this page. Contact your workspace admin
                if you think this is a mistake.
            </p>
        </div>
    );
}

interface CanPageProps {
    /** The action to check */
    action: string;
    /** The resource to check */
    resource: string;
    /** Override workspace context */
    workspaceId?: string | null;
    /** Check at platform or workspace scope */
    scope?: 'workspace' | 'platform';
    /** Custom access denied view */
    fallback?: ReactNode;
    children: ReactNode;
}

export function CanPage({
    action,
    resource,
    workspaceId,
    scope,
    fallback,
    children,
}: CanPageProps) {
    return (
        <Can
            action={action}
            resource={resource}
            workspaceId={workspaceId}
            scope={scope}
            fallback={fallback ?? <AccessDeniedPage />}
        >
            {children}
        </Can>
    );
}

// ---------------------------------------------------------------------------
// Hook: useCanAccess — imperative dynamic permission check
// ---------------------------------------------------------------------------

/**
 * Hook for checking resource.action permissions in components.
 *
 * @example
 *   const canCreateAsset = useCanAccess('assets', 'create');
 *   const canManageBilling = useCanAccess('billing', 'manage');
 */
export function useCanAccess(
    resource: string,
    action: string,
    options?: { workspaceId?: string | null; scope?: 'workspace' | 'platform' },
): boolean {
    const user = useAuthStore((state) => state.user);
    const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);

    return useMemo(
        () => checkDynamicPermission(
            user,
            activeWorkspaceId,
            resource,
            action,
            options?.scope,
            options?.workspaceId,
        ),
        [user, activeWorkspaceId, resource, action, options?.scope, options?.workspaceId],
    );
}
