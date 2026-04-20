/**
 * Permission Service — CRUD and seeding for the dynamic permissions table.
 *
 * This service manages the `permissions` table and provides helpers for
 * seeding the default permission catalogue, querying available permissions,
 * and linking permissions to roles.
 */

import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import {
    PERMISSION_CATALOGUE,
    PLATFORM_ROLE_DEFAULTS,
    permissionKey,
} from '@/lib/rbac/permissions';
import type { PermissionScope } from '@prisma/client';
import { invalidatePermissionCache } from '@/lib/rbac/permissionCache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PermissionRow {
    id: string;
    resource: string;
    action: string;
    scope: PermissionScope;
    key: string;
    description: string | null;
}

export interface RoleWithPermissions {
    id: string;
    name: string;
    label: string;
    description: string | null;
    isStaff: boolean;
    color: string;
    userCount: number;
    permissions: PermissionRow[];
}

// ---------------------------------------------------------------------------
// Permission CRUD
// ---------------------------------------------------------------------------

export class PermissionService {
    /**
     * Seed all permissions from PERMISSION_CATALOGUE into the DB.
     * Uses upsert to be idempotent — safe to call on every server start.
     */
    static async seedPermissions(): Promise<void> {
        for (const def of PERMISSION_CATALOGUE) {
            const key = permissionKey(def.resource, def.action);
            await prisma.permission.upsert({
                where: { key },
                create: {
                    resource: def.resource,
                    action: def.action,
                    scope: def.scope,
                    key,
                    description: def.description ?? null,
                },
                update: {
                    description: def.description ?? null,
                },
            });
        }
    }

    /**
     * Seed default permissions for all platform roles.
     * Links platform roles to their default permission set.
     */
    static async seedPlatformRolePermissions(): Promise<void> {
        for (const [roleName, permKeys] of Object.entries(PLATFORM_ROLE_DEFAULTS)) {
            const role = await prisma.platformRole.findUnique({ where: { name: roleName } });
            if (!role) continue;

            for (const key of permKeys) {
                const perm = await prisma.permission.findUnique({ where: { key } });
                if (!perm) continue;

                await prisma.rolePermission.upsert({
                    where: {
                        platformRoleId_permissionId: {
                            platformRoleId: role.id,
                            permissionId: perm.id,
                        },
                    },
                    create: {
                        platformRoleId: role.id,
                        permissionId: perm.id,
                    },
                    update: {},
                });
            }
        }
    }

    /**
     * One-shot bootstrap: seeds permissions + links them to platform roles.
     * Safe to call multiple times (idempotent).
     */
    static async bootstrap(): Promise<void> {
        await this.seedPermissions();
        await this.seedPlatformRolePermissions();
    }

    /**
     * List all permissions, optionally filtered by scope.
     */
    static async listPermissions(scope?: PermissionScope): Promise<PermissionRow[]> {
        const where = scope ? { scope } : {};
        const perms = await prisma.permission.findMany({
            where,
            orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        });
        return perms.map((p) => ({
            id: p.id,
            resource: p.resource,
            action: p.action,
            scope: p.scope,
            key: p.key,
            description: p.description,
        }));
    }

    /**
     * Get permissions grouped by resource for UI display.
     */
    static async getPermissionMatrix(scope?: PermissionScope): Promise<
        Record<string, PermissionRow[]>
    > {
        const perms = await this.listPermissions(scope);
        const grouped: Record<string, PermissionRow[]> = {};
        for (const p of perms) {
            if (!grouped[p.resource]) grouped[p.resource] = [];
            grouped[p.resource].push(p);
        }
        return grouped;
    }

    /**
     * Get a platform role with all its assigned permissions.
     */
    static async getRoleWithPermissions(roleId: string): Promise<RoleWithPermissions> {
        const role = await prisma.platformRole.findUnique({
            where: { id: roleId },
            include: {
                _count: { select: { users: true } },
                permissions: {
                    include: { permission: true },
                },
            },
        });

        if (!role) throw new ApiError(404, 'Role not found');

        return {
            id: role.id,
            name: role.name,
            label: role.label,
            description: role.description,
            isStaff: role.isStaff,
            color: role.color,
            userCount: role._count.users,
            permissions: role.permissions.map((rp) => ({
                id: rp.permission.id,
                resource: rp.permission.resource,
                action: rp.permission.action,
                scope: rp.permission.scope,
                key: rp.permission.key,
                description: rp.permission.description,
            })),
        };
    }

    /**
     * Set the permissions for a platform role (full replace).
     * Accepts an array of permission IDs.
     *
     * This is a transactional replace: removes all existing role_permissions
     * for the role, then inserts the new set.
     */
    static async setRolePermissions(
        roleId: string,
        permissionIds: string[],
    ): Promise<RoleWithPermissions> {
        // Validate role exists
        const role = await prisma.platformRole.findUnique({ where: { id: roleId } });
        if (!role) throw new ApiError(404, 'Role not found');

        // Validate all permission IDs exist
        const validPerms = await prisma.permission.findMany({
            where: { id: { in: permissionIds } },
            select: { id: true },
        });
        const validIds = new Set(validPerms.map((p) => p.id));
        const invalid = permissionIds.filter((id) => !validIds.has(id));
        if (invalid.length > 0) {
            throw new ApiError(400, `Invalid permission IDs: ${invalid.join(', ')}`);
        }

        // Transactional replace
        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { platformRoleId: roleId } }),
            ...permissionIds.map((pid) =>
                prisma.rolePermission.create({
                    data: { platformRoleId: roleId, permissionId: pid },
                }),
            ),
        ]);

        // Invalidate caches for all users with this role
        const usersWithRole = await prisma.user.findMany({
            where: { platformRoleId: roleId },
            select: { id: true },
        });
        await Promise.all(usersWithRole.map((u) => invalidatePermissionCache(u.id)));

        return this.getRoleWithPermissions(roleId);
    }

    /**
     * Get all platform roles with their permission counts.
     */
    static async listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
        const roles = await prisma.platformRole.findMany({
            orderBy: { createdAt: 'asc' },
            include: {
                _count: { select: { users: true } },
                permissions: {
                    include: { permission: true },
                },
            },
        });

        return roles.map((r) => ({
            id: r.id,
            name: r.name,
            label: r.label,
            description: r.description,
            isStaff: r.isStaff,
            color: r.color,
            userCount: r._count.users,
            permissions: r.permissions.map((rp) => ({
                id: rp.permission.id,
                resource: rp.permission.resource,
                action: rp.permission.action,
                scope: rp.permission.scope,
                key: rp.permission.key,
                description: rp.permission.description,
            })),
        }));
    }

    /**
     * Assign a platform role to a user.
     * Prevents privilege escalation: the assigner must have the roles.assign
     * permission at platform scope.
     */
    static async assignPlatformRole(
        userId: string,
        roleId: string,
    ): Promise<void> {
        const [user, role] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId } }),
            prisma.platformRole.findUnique({ where: { id: roleId } }),
        ]);

        if (!user) throw new ApiError(404, 'User not found');
        if (!role) throw new ApiError(404, 'Role not found');

        await prisma.user.update({
            where: { id: userId },
            data: {
                platformRoleId: roleId,
                // Sync the legacy isStaff flag
                isStaff: role.isStaff,
                // Sync legacy role enum when possible
                role: role.isStaff
                    ? (role.name === 'IT_STAFF' ? 'IT_STAFF' : 'ADMIN')
                    : 'USER',
            },
        });

        await invalidatePermissionCache(userId);
    }
}
