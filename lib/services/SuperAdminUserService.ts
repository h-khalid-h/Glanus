/**
 * SuperAdminUserService
 *
 * Platform-level user management for super-admin staff.
 */

import { prisma } from '@/lib/db';
import type { UserRole, Prisma } from '@prisma/client';
import { ApiError } from '@/lib/errors';
import { invalidatePermissionCache } from '@/lib/rbac/permissionCache';
import { logError } from '@/lib/logger';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformRoleSummary {
    id: string;
    name: string;
    label: string;
    color: string;
    isStaff: boolean;
}

export interface UserRow {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    platformRole: PlatformRoleSummary | null;
    isStaff: boolean;
    emailVerified: boolean;
    onboardingCompleted: boolean;
    createdAt: Date;
    workspaceCount: number;
}

export interface UserListResult {
    users: UserRow[];
    total: number;
}

export interface WorkspaceMembershipSummary {
    workspaceId: string;
    workspaceName: string;
    slug: string;
    role: string;
    isOwner: boolean;
    memberSince: Date;
}

export interface UserDetail extends Omit<UserRow, 'workspaceCount'> {
    updatedAt: Date;
    workspaces: WorkspaceMembershipSummary[];
}

export interface CreateUserInput {
    email: string;
    name: string;
    password: string;
    role: UserRole;
    platformRoleId?: string;
    isStaff?: boolean;
    emailVerified?: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SuperAdminUserService {
    /**
     * Paginated, searchable list of all platform users.
     * Enriched with workspace membership count.
     * Single query using aggregate — zero N+1.
     */
    static async listUsers(
        page = 1,
        limit = 20,
        search = '',
        roleFilter?: UserRole | 'STAFF',
        isStaff?: boolean,
    ): Promise<UserListResult> {
        // Build where clause
        const where: Prisma.UserWhereInput = {};

        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { name:  { contains: search, mode: 'insensitive' } },
            ];
        }

        // Explicit isStaff filter takes priority
        if (isStaff !== undefined) {
            where.isStaff = isStaff;
        }

        if (roleFilter === 'STAFF') {
            where.isStaff = true;
        } else if (roleFilter) {
            where.role = roleFilter;
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    isStaff: true,
                    emailVerified: true,
                    onboardingCompleted: true,
                    createdAt: true,
                    platformRole: {
                        select: { id: true, name: true, label: true, color: true, isStaff: true },
                    },
                    _count: {
                        select: {
                            workspaceMemberships: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.user.count({ where }),
        ]);

        return {
            total,
            users: users.map((u) => ({
                id: u.id,
                email: u.email,
                name: u.name,
                role: u.role,
                platformRole: u.platformRole ?? null,
                isStaff: u.isStaff,
                emailVerified: u.emailVerified,
                onboardingCompleted: u.onboardingCompleted,
                createdAt: u.createdAt,
                workspaceCount: u._count.workspaceMemberships,
            })),
        };
    }

    /**
     * Full user profile with all workspace memberships.
     * Single query — zero N+1.
     */
    static async getUserDetail(userId: string): Promise<UserDetail> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isStaff: true,
                emailVerified: true,
                onboardingCompleted: true,
                createdAt: true,
                updatedAt: true,
                platformRole: {
                    select: { id: true, name: true, label: true, color: true, isStaff: true },
                },
                workspaceMemberships: {
                    include: {
                        workspace: {
                            select: { id: true, name: true, slug: true },
                        },
                    },
                },
                ownedWorkspaces: {
                    where: { deletedAt: null },
                    select: { id: true, name: true, slug: true, createdAt: true },
                },
            },
        });

        if (!user) throw new ApiError(404, 'User not found');

        const ownedSet = new Set(user.ownedWorkspaces.map((w) => w.id));

        const ownedEntries: WorkspaceMembershipSummary[] = user.ownedWorkspaces.map((w) => ({
            workspaceId: w.id,
            workspaceName: w.name,
            slug: w.slug,
            role: 'OWNER',
            isOwner: true,
            memberSince: w.createdAt,
        }));

        const memberEntries: WorkspaceMembershipSummary[] = user.workspaceMemberships
            .filter((m) => !ownedSet.has(m.workspaceId))
            .map((m) => ({
                workspaceId: m.workspaceId,
                workspaceName: m.workspace.name,
                slug: m.workspace.slug,
                role: m.role as string,
                isOwner: false,
                memberSince: m.joinedAt,
            }));

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            platformRole: user.platformRole ?? null,
            isStaff: user.isStaff,
            emailVerified: user.emailVerified,
            onboardingCompleted: user.onboardingCompleted,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            workspaces: [...ownedEntries, ...memberEntries],
        };
    }

    /**
     * Update a user's platform role (USER | IT_STAFF | ADMIN).
     * Also links the matching PlatformRole row if one exists.
     * Automatically syncs isStaff: ADMIN|IT_STAFF→true, USER→false.
     */
    static async updateUserRole(
        targetId: string,
        newRole: UserRole,
        actorId: string,
    ): Promise<void> {
        if (targetId === actorId) {
            throw new ApiError(400, 'Cannot change your own role');
        }

        const isStaff = newRole === 'ADMIN' || newRole === 'IT_STAFF';

        // Find matching PlatformRole by enum name for the FK link
        const platformRole = await prisma.platformRole.findUnique({ where: { name: newRole } });

        await prisma.user.update({
            where: { id: targetId },
            data: {
                role: newRole,
                isStaff,
                ...(platformRole ? { platformRoleId: platformRole.id } : {}),
            },
        });

        invalidatePermissionCache(targetId).catch(
            (err: unknown) => logError('Failed to invalidate cache after role update', err),
        );
    }

    /**
     * Update only the platformRoleId FK (dynamic role assignment without enum change).
     * Also syncs isStaff from the PlatformRole.isStaff flag.
     */
    static async assignPlatformRole(
        targetId: string,
        platformRoleId: string,
        actorId: string,
    ): Promise<void> {
        if (targetId === actorId) throw new ApiError(400, 'Cannot change your own role');

        const pr = await prisma.platformRole.findUnique({ where: { id: platformRoleId } });
        if (!pr) throw new ApiError(404, 'Platform role not found');

        // Map PlatformRole.name → UserRole enum if it matches
        const enumRole = (['ADMIN', 'IT_STAFF', 'USER'] as UserRole[]).includes(pr.name as UserRole)
            ? (pr.name as UserRole)
            : undefined;

        await prisma.user.update({
            where: { id: targetId },
            data: {
                platformRoleId,
                isStaff: pr.isStaff,
                ...(enumRole ? { role: enumRole } : {}),
            },
        });

        invalidatePermissionCache(targetId).catch(
            (err: unknown) => logError('Failed to invalidate cache after platform role update', err),
        );
    }

    /**
     * Create a new platform user (admin-initiated, no invitation flow).
     * Password is hashed with bcrypt cost 12.
     */
    static async createUser(input: CreateUserInput): Promise<UserDetail> {
        const existing = await prisma.user.findUnique({ where: { email: input.email } });
        if (existing) throw new ApiError(409, 'A user with this email already exists');

        if (input.platformRoleId) {
            const pr = await prisma.platformRole.findUnique({ where: { id: input.platformRoleId } });
            if (!pr) throw new ApiError(400, 'Selected platform role does not exist');
        }

        const hashedPassword = await bcrypt.hash(input.password, 12);

        const user = await prisma.user.create({
            data: {
                email: input.email.toLowerCase().trim(),
                name: input.name.trim(),
                password: hashedPassword,
                role: input.role,
                isStaff: input.isStaff ?? (input.role === 'ADMIN' || input.role === 'IT_STAFF'),
                emailVerified: input.emailVerified ?? false,
                onboardingCompleted: false,
                ...(input.platformRoleId ? { platformRoleId: input.platformRoleId } : {}),
            },
        });

        return SuperAdminUserService.getUserDetail(user.id);
    }

    /**
     * Toggle the isStaff flag without changing the user's role.
     */
    static async setStaffAccess(
        targetId: string,
        isStaff: boolean,
        actorId: string,
    ): Promise<void> {
        if (targetId === actorId) {
            throw new ApiError(400, 'Cannot change your own staff access');
        }

        await prisma.user.update({
            where: { id: targetId },
            data: { isStaff },
        });

        invalidatePermissionCache(targetId).catch(
            (err: unknown) => logError('Failed to invalidate cache after staff toggle', err),
        );
    }
}
