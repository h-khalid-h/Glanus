/**
 * Workspace Role Service — CRUD for workspace-level custom roles.
 *
 * Workspace Owners and Admins can create custom roles within their workspace
 * and assign dynamic permissions to those roles. This service enforces scope
 * isolation: workspace roles can only reference WORKSPACE-scoped permissions.
 */

import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { invalidatePermissionCache } from '@/lib/rbac/permissionCache';
import { WORKSPACE_ROLE_DEFAULTS } from '@/lib/rbac/permissions';
import type { WorkspaceRole } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceCustomRoleRow {
    id: string;
    workspaceId: string;
    name: string;
    label: string;
    description: string | null;
    color: string;
    baseRole: WorkspaceRole | null;
    memberCount: number;
    permissions: Array<{
        id: string;
        key: string;
        resource: string;
        action: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WorkspaceRoleService {
    /**
     * Seed the built-in workspace roles as custom roles for a workspace.
     * Called when a workspace is created or when the roles page is first accessed.
     */
    static async seedDefaultRoles(workspaceId: string): Promise<void> {
        const builtInRoles: Array<{
            name: string;
            label: string;
            baseRole: WorkspaceRole;
            color: string;
        }> = [
            { name: 'VIEWER', label: 'Viewer', baseRole: 'VIEWER', color: '#64748b' },
            { name: 'MEMBER', label: 'Member', baseRole: 'MEMBER', color: '#14b8a6' },
            { name: 'STAFF',  label: 'Staff',  baseRole: 'STAFF',  color: '#0ea5e9' },
            { name: 'ADMIN',  label: 'Admin',  baseRole: 'ADMIN',  color: '#6366f1' },
            { name: 'OWNER',  label: 'Owner',  baseRole: 'OWNER',  color: '#f59e0b' },
        ];

        for (const roleDef of builtInRoles) {
            const existing = await prisma.workspaceCustomRole.findUnique({
                where: { workspaceId_name: { workspaceId, name: roleDef.name } },
            });
            if (existing) continue;

            const role = await prisma.workspaceCustomRole.create({
                data: {
                    workspaceId,
                    name: roleDef.name,
                    label: roleDef.label,
                    baseRole: roleDef.baseRole,
                    color: roleDef.color,
                    description: `Default ${roleDef.label} role`,
                },
            });

            // Link default permissions
            const permKeys = WORKSPACE_ROLE_DEFAULTS[roleDef.name] ?? [];
            for (const key of permKeys) {
                const perm = await prisma.permission.findUnique({ where: { key } });
                if (!perm) continue;

                await prisma.workspaceRolePermission.create({
                    data: {
                        workspaceCustomRoleId: role.id,
                        permissionId: perm.id,
                    },
                });
            }
        }
    }

    /**
     * List all custom roles for a workspace.
     */
    static async listRoles(workspaceId: string): Promise<WorkspaceCustomRoleRow[]> {
        const roles = await prisma.workspaceCustomRole.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'asc' },
            include: {
                _count: { select: { members: true } },
                permissions: {
                    include: { permission: true },
                },
            },
        });

        return roles.map((r) => ({
            id: r.id,
            workspaceId: r.workspaceId,
            name: r.name,
            label: r.label,
            description: r.description,
            color: r.color,
            baseRole: r.baseRole,
            memberCount: r._count.members,
            permissions: r.permissions.map((rp) => ({
                id: rp.permission.id,
                key: rp.permission.key,
                resource: rp.permission.resource,
                action: rp.permission.action,
            })),
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
        }));
    }

    /**
     * Get a single custom role by ID within a workspace.
     */
    static async getRole(workspaceId: string, roleId: string): Promise<WorkspaceCustomRoleRow> {
        const role = await prisma.workspaceCustomRole.findFirst({
            where: { id: roleId, workspaceId },
            include: {
                _count: { select: { members: true } },
                permissions: {
                    include: { permission: true },
                },
            },
        });

        if (!role) throw new ApiError(404, 'Role not found');

        return {
            id: role.id,
            workspaceId: role.workspaceId,
            name: role.name,
            label: role.label,
            description: role.description,
            color: role.color,
            baseRole: role.baseRole,
            memberCount: role._count.members,
            permissions: role.permissions.map((rp) => ({
                id: rp.permission.id,
                key: rp.permission.key,
                resource: rp.permission.resource,
                action: rp.permission.action,
            })),
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
        };
    }

    /**
     * Create a new custom workspace role.
     */
    static async createRole(
        workspaceId: string,
        data: {
            name: string;
            label: string;
            description?: string;
            color?: string;
            baseRole?: WorkspaceRole;
            permissionIds?: string[];
        },
    ): Promise<WorkspaceCustomRoleRow> {
        // Check for name collision
        const existing = await prisma.workspaceCustomRole.findUnique({
            where: { workspaceId_name: { workspaceId, name: data.name } },
        });
        if (existing) throw new ApiError(409, `Role "${data.name}" already exists in this workspace`);

        // Validate permission IDs: must all be WORKSPACE-scoped
        if (data.permissionIds?.length) {
            const perms = await prisma.permission.findMany({
                where: { id: { in: data.permissionIds } },
                select: { id: true, scope: true },
            });
            const invalid = perms.filter((p) => p.scope !== 'WORKSPACE');
            if (invalid.length > 0) {
                throw new ApiError(400, 'Workspace roles can only have WORKSPACE-scoped permissions');
            }
            const validIds = new Set(perms.map((p) => p.id));
            const missing = data.permissionIds.filter((id) => !validIds.has(id));
            if (missing.length > 0) {
                throw new ApiError(400, `Invalid permission IDs: ${missing.join(', ')}`);
            }
        }

        const role = await prisma.workspaceCustomRole.create({
            data: {
                workspaceId,
                name: data.name,
                label: data.label,
                description: data.description ?? null,
                color: data.color ?? '#6366f1',
                baseRole: data.baseRole ?? null,
                permissions: data.permissionIds?.length
                    ? {
                        create: data.permissionIds.map((pid) => ({
                            permissionId: pid,
                        })),
                    }
                    : undefined,
            },
            include: {
                _count: { select: { members: true } },
                permissions: { include: { permission: true } },
            },
        });

        return {
            id: role.id,
            workspaceId: role.workspaceId,
            name: role.name,
            label: role.label,
            description: role.description,
            color: role.color,
            baseRole: role.baseRole,
            memberCount: role._count.members,
            permissions: role.permissions.map((rp) => ({
                id: rp.permission.id,
                key: rp.permission.key,
                resource: rp.permission.resource,
                action: rp.permission.action,
            })),
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
        };
    }

    /**
     * Update a custom workspace role (label, description, color, permissions).
     */
    static async updateRole(
        workspaceId: string,
        roleId: string,
        data: {
            label?: string;
            description?: string;
            color?: string;
            permissionIds?: string[];
        },
    ): Promise<WorkspaceCustomRoleRow> {
        const role = await prisma.workspaceCustomRole.findFirst({
            where: { id: roleId, workspaceId },
        });
        if (!role) throw new ApiError(404, 'Role not found');

        // Validate permission IDs scope
        if (data.permissionIds) {
            const perms = await prisma.permission.findMany({
                where: { id: { in: data.permissionIds } },
                select: { id: true, scope: true },
            });
            const invalid = perms.filter((p) => p.scope !== 'WORKSPACE');
            if (invalid.length > 0) {
                throw new ApiError(400, 'Workspace roles can only have WORKSPACE-scoped permissions');
            }
        }

        // Update role metadata
        await prisma.workspaceCustomRole.update({
            where: { id: roleId },
            data: {
                ...(data.label !== undefined ? { label: data.label } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.color !== undefined ? { color: data.color } : {}),
            },
        });

        // Replace permissions if provided
        if (data.permissionIds) {
            await prisma.$transaction([
                prisma.workspaceRolePermission.deleteMany({
                    where: { workspaceCustomRoleId: roleId },
                }),
                ...data.permissionIds.map((pid) =>
                    prisma.workspaceRolePermission.create({
                        data: { workspaceCustomRoleId: roleId, permissionId: pid },
                    }),
                ),
            ]);

            // Invalidate cache for all members of this role
            const members = await prisma.workspaceCustomRoleMember.findMany({
                where: { roleId },
                select: { userId: true },
            });
            await Promise.all(members.map((m) => invalidatePermissionCache(m.userId)));
        }

        return this.getRole(workspaceId, roleId);
    }

    /**
     * Delete a custom workspace role. Built-in roles (with baseRole set) cannot be deleted.
     */
    static async deleteRole(workspaceId: string, roleId: string): Promise<void> {
        const role = await prisma.workspaceCustomRole.findFirst({
            where: { id: roleId, workspaceId },
        });
        if (!role) throw new ApiError(404, 'Role not found');
        if (role.baseRole) throw new ApiError(400, 'Cannot delete a built-in role');

        // Invalidate cache for members before deletion
        const members = await prisma.workspaceCustomRoleMember.findMany({
            where: { roleId },
            select: { userId: true },
        });

        await prisma.workspaceCustomRole.delete({ where: { id: roleId } });

        await Promise.all(members.map((m) => invalidatePermissionCache(m.userId)));
    }

    /**
     * Assign a user to a custom workspace role.
     */
    static async assignMember(roleId: string, userId: string): Promise<void> {
        const role = await prisma.workspaceCustomRole.findUnique({
            where: { id: roleId },
            select: { id: true, workspaceId: true },
        });
        if (!role) throw new ApiError(404, 'Role not found');

        // Verify user is a member of the workspace
        const membership = await prisma.workspaceMember.findFirst({
            where: { workspaceId: role.workspaceId, userId },
        });
        if (!membership) throw new ApiError(400, 'User is not a member of this workspace');

        await prisma.workspaceCustomRoleMember.upsert({
            where: { roleId_userId: { roleId, userId } },
            create: { roleId, userId },
            update: {},
        });

        await invalidatePermissionCache(userId);
    }

    /**
     * Remove a user from a custom workspace role.
     */
    static async removeMember(roleId: string, userId: string): Promise<void> {
        await prisma.workspaceCustomRoleMember.deleteMany({
            where: { roleId, userId },
        });
        await invalidatePermissionCache(userId);
    }
}
