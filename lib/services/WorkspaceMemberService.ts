import { ApiError } from '@/lib/errors';
import { invalidatePermissionCache } from '@/lib/rbac/permissionCache';
/**
 * WorkspaceMemberService — Workspace membership management.
 *
 * Responsibilities:
 *  - listMembers: fetch all members, prepending owner as a synthetic OWNER entry
 *  - updateMemberRole: ADMIN|MEMBER|VIEWER role transition with non-blocking email notification
 *  - updateMember: edit name/email/role/isActive for a member
 *  - resetMemberPassword: generate/set a secure password for a member
 *  - removeMember: delete the membership record with non-blocking removal email
 *
 * Note: workspace CRUD and the unified activity feed live in WorkspaceService.
 */
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { auditLog } from '@/lib/workspace/auditLog';
import { sendEmail } from '@/lib/email/sendgrid';
import { getRoleChangedEmailTemplate, getMemberRemovedEmailTemplate } from '@/lib/email/templates';
import { revokeWorkspaceClaim } from '@/lib/auth/claim-revocation';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export class WorkspaceMemberService {
    /**
     * List all members in a workspace.
     * Owner is prepended as a synthetic OWNER entry with id 'owner'.
     */
    static async listMembers(workspaceId: string, page = 1, limit = 20) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { ownerId: true, createdAt: true },
        });
        if (!workspace) throw new ApiError(404, 'Workspace not found');

        const [members, total, owner] = await Promise.all([
            prisma.workspaceMember.findMany({
                where: { workspaceId, userId: { not: workspace.ownerId } },
                include: { user: { select: { id: true, name: true, email: true, isActive: true, createdAt: true } } },
                orderBy: { joinedAt: 'asc' },
                skip: page === 1 ? 0 : (page - 1) * limit - 1,   // account for synthetic owner row on page 1
                take: page === 1 ? limit - 1 : limit,
            }),
            prisma.workspaceMember.count({ where: { workspaceId, userId: { not: workspace.ownerId } } }),
            prisma.user.findUnique({
                where: { id: workspace.ownerId },
                select: { id: true, name: true, email: true, isActive: true, createdAt: true },
            }),
        ]);

        if (!owner) throw new ApiError(404, 'Workspace owner not found');

        const totalWithOwner = total + 1; // +1 for synthetic owner
        const allMembers = page === 1
            ? [
                {
                    id: 'owner',
                    workspaceId,
                    userId: workspace.ownerId,
                    role: 'OWNER',
                    joinedAt: workspace.createdAt,
                    user: owner,
                },
                ...members,
            ]
            : members;

        return {
            members: allMembers,
            pagination: { page, limit, total: totalWithOwner, totalPages: Math.ceil(totalWithOwner / limit) },
        };
    }

    /**
     * Update a member's role. Sends a non-blocking email notification to the affected member.
     * Throws 400 if caller attempts to change the owner's role.
     */
    static async updateMemberRole(
        workspaceId: string,
        memberId: string,
        userId: string,
        newRole: 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER',
        workspaceName: string,
    ) {
        if (memberId === 'owner') {
            throw new ApiError(400, 'Cannot change owner role');
        }

        const targetMember = await prisma.workspaceMember.findFirst({
            where: { id: memberId, workspaceId },
            include: { user: { select: { name: true, email: true } } },
        });
        if (!targetMember) throw new ApiError(404, 'Member not found');

        const oldRole = targetMember.role;

        const updated = await prisma.workspaceMember.update({
            where: { id: memberId },
            data: { role: newRole },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        sendEmail({
            to: updated.user.email,
            subject: `Your role in ${workspaceName} has been updated`,
            html: getRoleChangedEmailTemplate(
                updated.user.name || updated.user.email,
                oldRole,
                newRole,
                workspaceName,
            ),
        }).catch((err: unknown) => logError('Failed to send role change email', err));

        await auditLog({
            workspaceId,
            userId,
            action: 'member.role_changed',
            resourceType: 'WorkspaceMember',
            resourceId: memberId,
            details: { oldRole, newRole },
        });

        // Revoke the affected member's workspace claim so the next API request
        // re-validates their role from the DB instead of the now-stale JWT claim.
        revokeWorkspaceClaim(workspaceId, updated.user.id).catch(
            (err: unknown) => logError('Failed to revoke workspace claim', err)
        );

        // Invalidate RBAC permission cache so the next /me call rebuilds permissions.
        invalidatePermissionCache(updated.user.id).catch(
            (err: unknown) => logError('Failed to invalidate permission cache', err)
        );

        return updated;
    }

    /**
     * Update member profile fields (name, email) and/or workspace role and/or active status.
     * Actors cannot deactivate themselves.
     */
    static async updateMember(
        workspaceId: string,
        memberId: string,
        actorId: string,
        data: { name?: string; email?: string; role?: 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER'; isActive?: boolean },
        workspaceName: string,
    ) {
        if (memberId === 'owner') throw new ApiError(400, 'Cannot edit owner via this endpoint');

        const targetMember = await prisma.workspaceMember.findFirst({
            where: { id: memberId, workspaceId },
            include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
        });
        if (!targetMember) throw new ApiError(404, 'Member not found');

        // Self-deactivation guard
        if (data.isActive === false && targetMember.userId === actorId) {
            throw new ApiError(400, 'You cannot deactivate your own account');
        }

        const changes: Record<string, unknown> = {};

        // Update user profile fields if provided
        if (data.name !== undefined || data.email !== undefined || data.isActive !== undefined) {
            const userUpdate: { name?: string; email?: string; isActive?: boolean } = {};
            if (data.name !== undefined) userUpdate.name = data.name;
            if (data.email !== undefined) {
                // Check email uniqueness
                const existing = await prisma.user.findUnique({ where: { email: data.email } });
                if (existing && existing.id !== targetMember.userId) {
                    throw new ApiError(409, 'Email already in use by another account');
                }
                userUpdate.email = data.email;
            }
            if (data.isActive !== undefined) {
                userUpdate.isActive = data.isActive;
                changes.isActive = { from: targetMember.user.isActive, to: data.isActive };
            }
            await prisma.user.update({ where: { id: targetMember.userId }, data: userUpdate });
            if (data.name !== undefined) changes.name = { from: targetMember.user.name, to: data.name };
            if (data.email !== undefined) changes.email = { from: targetMember.user.email, to: data.email };
        }

        // Update workspace role if provided
        let updatedMember = targetMember;
        if (data.role !== undefined && data.role !== targetMember.role) {
            changes.role = { from: targetMember.role, to: data.role };
            updatedMember = await prisma.workspaceMember.update({
                where: { id: memberId },
                data: { role: data.role },
                include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
            });
            sendEmail({
                to: updatedMember.user.email,
                subject: `Your role in ${workspaceName} has been updated`,
                html: getRoleChangedEmailTemplate(
                    updatedMember.user.name || updatedMember.user.email,
                    targetMember.role,
                    data.role,
                    workspaceName,
                ),
            }).catch((err: unknown) => logError('Failed to send role change email', err));
        }

        await auditLog({
            workspaceId,
            userId: actorId,
            action: 'member.updated',
            resourceType: 'WorkspaceMember',
            resourceId: memberId,
            details: { changes },
        });

        if (data.isActive === false) {
            // Revoke session so the deactivated user is signed out
            revokeWorkspaceClaim(workspaceId, targetMember.userId).catch(
                (err: unknown) => logError('Failed to revoke workspace claim', err)
            );
        }
        if (data.role !== undefined) {
            revokeWorkspaceClaim(workspaceId, targetMember.userId).catch(
                (err: unknown) => logError('Failed to revoke workspace claim', err)
            );
        }
        invalidatePermissionCache(targetMember.userId).catch(
            (err: unknown) => logError('Failed to invalidate permission cache', err)
        );

        // Return fresh data
        return prisma.workspaceMember.findFirst({
            where: { id: memberId },
            include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
        });
    }

    /**
     * Reset a member's password. Generates a cryptographically secure random password
     * if none is provided. Returns the plaintext password exactly once.
     * Never logs plaintext passwords.
     */
    static async resetMemberPassword(
        workspaceId: string,
        memberId: string,
        actorId: string,
        providedPassword?: string,
    ) {
        if (memberId === 'owner') throw new ApiError(400, 'Cannot reset owner password via this endpoint');

        const targetMember = await prisma.workspaceMember.findFirst({
            where: { id: memberId, workspaceId },
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        if (!targetMember) throw new ApiError(404, 'Member not found');

        // Generate a secure random password if not provided
        const plaintext = providedPassword ?? crypto.randomBytes(12).toString('base64url').slice(0, 16);

        // Validate if provided (min 8 chars)
        if (providedPassword && providedPassword.length < 8) {
            throw new ApiError(400, 'Password must be at least 8 characters');
        }

        const hashed = await bcrypt.hash(plaintext, 12);

        await prisma.user.update({
            where: { id: targetMember.userId },
            data: { password: hashed, mustChangePassword: true, passwordChangedAt: null },
        });

        await auditLog({
            workspaceId,
            userId: actorId,
            action: 'member.password_reset',
            resourceType: 'WorkspaceMember',
            resourceId: memberId,
            details: { targetEmail: targetMember.user.email },
        });

        // Return temporary password — caller must handle it securely and not persist it
        return { temporaryPassword: plaintext, targetEmail: targetMember.user.email };
    }

    /**
     * Remove a member from a workspace. Sends a non-blocking removal notification email.
     * Throws 400 if caller attempts to remove the owner.
     */
    static async removeMember(
        workspaceId: string,
        memberId: string,
        userId: string,
        workspaceName: string,
    ) {
        if (memberId === 'owner') {
            throw new ApiError(400, 'Cannot remove owner from workspace');
        }

        const memberToRemove = await prisma.workspaceMember.findFirst({
            where: { id: memberId, workspaceId },
            include: { user: { select: { name: true, email: true } } },
        });
        if (!memberToRemove) throw new ApiError(404, 'Member not found');

        await prisma.workspaceMember.delete({ where: { id: memberId } });

        sendEmail({
            to: memberToRemove.user.email,
            subject: `You've been removed from ${workspaceName}`,
            html: getMemberRemovedEmailTemplate(
                memberToRemove.user.name || memberToRemove.user.email,
                workspaceName,
            ),
        }).catch((err: unknown) => logError('Failed to send removal email', err));

        await auditLog({
            workspaceId,
            userId,
            action: 'member.removed',
            resourceType: 'WorkspaceMember',
            resourceId: memberId,
            details: { removedUser: memberToRemove.user.email },
        });

        // Revoke the removed member's workspace claim immediately.
        revokeWorkspaceClaim(workspaceId, memberToRemove.userId).catch(
            (err: unknown) => logError('Failed to revoke workspace claim on removal', err)
        );

        // Invalidate RBAC permission cache for the removed member.
        invalidatePermissionCache(memberToRemove.userId).catch(
            (err: unknown) => logError('Failed to invalidate permission cache on removal', err)
        );
    }
}
