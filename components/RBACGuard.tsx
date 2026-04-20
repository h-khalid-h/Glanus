'use client';

/**
 * RBACGuard — page/component-level permission gate.
 *
 * Renders `children` only when the current user has `permission`.
 * Falls back to the provided `fallback` node or a default <AccessDenied />
 * view when access is denied.
 *
 * @example
 *   // Wrap a button — hides it for users without the permission
 *   <RBACGuard permission={PERMISSIONS.INVITE_MEMBERS}>
 *     <InviteMemberButton />
 *   </RBACGuard>
 *
 *   // Full-page route guard with custom fallback
 *   <RBACGuard permission={PERMISSIONS.MANAGE_BILLING} fallback={<Redirect to="/dashboard" />}>
 *     <BillingPage />
 *   </RBACGuard>
 */

import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useCan } from '@/hooks/useCan';

// ---------------------------------------------------------------------------
// Default "Access Denied" view shown when no fallback is provided
// ---------------------------------------------------------------------------
function AccessDenied() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[320px] py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
                You don&apos;t have permission to view this content. Contact your workspace admin
                if you think this is a mistake.
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// RBACGuard component
// ---------------------------------------------------------------------------
interface RBACGuardProps {
    /** Permission key to check — use PERMISSIONS constants from utils/rbac. */
    permission: string;
    /** Override the workspace context for this specific check. */
    workspaceId?: string;
    /** Node rendered when the check fails. Defaults to <AccessDenied />. */
    fallback?: ReactNode;
    children: ReactNode;
}

export function RBACGuard({
    permission,
    workspaceId,
    fallback,
    children,
}: RBACGuardProps) {
    const allowed = useCan(permission, workspaceId);

    if (!allowed) {
        return <>{fallback ?? <AccessDenied />}</>;
    }

    return <>{children}</>;
}
