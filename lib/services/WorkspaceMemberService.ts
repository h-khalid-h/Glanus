/**
 * WorkspaceMemberService — Workspace membership management.
 *
 * Responsibilities:
 *  - listMembers: fetch all members, prepending owner as a synthetic OWNER entry
 *  - updateMemberRole: ADMIN|MEMBER|VIEWER role transition with non-blocking email notification
 *  - removeMember: delete the membership record with non-blocking removal email
 *
 * Note: workspace CRUD and the unified activity feed live in WorkspaceService.
 */
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { auditLog } from '@/lib/workspace/auditLog';
import { sendEmail } from '@/lib/email/sendgrid';
import { getRoleChangedEmailTemplate, getMemberRemovedEmailTemplate } from '@/lib/email/templates';

export class WorkspaceMemberService {
    /**
     * List all members in a workspace.
     * Owner is prepended as a synthetic OWNER entry with id 'owner'.
     */
    static async listMembers(workspaceId: string) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { ownerId: true, createdAt: true },
        });
        if (!workspace) throw Object.assign(new Error('Workspace not found'), { statusCode: 404 });

        const [members, owner] = await Promise.all([
            prisma.workspaceMember.findMany({
                where: { workspaceId },
                include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
                orderBy: { joinedAt: 'asc' },
            }),
            prisma.user.findUnique({
                where: { id: workspace.ownerId },
                select: { id: true, name: true, email: true, createdAt: true },
            }),
        ]);

        return [
            {
                id: 'owner',
                workspaceId,
                userId: workspace.ownerId,
                role: 'OWNER',
                joinedAt: workspace.createdAt,
                user: owner,
            },
            ...members,
        ];
    }

    /**
     * Update a member's role. Sends a non-blocking email notification to the affected member.
     * Throws 400 if caller attempts to change the owner's role.
     */
    static async updateMemberRole(
        workspaceId: string,
        memberId: string,
        userId: string,
        newRole: 'ADMIN' | 'MEMBER' | 'VIEWER',
        workspaceName: string,
    ) {
        if (memberId === 'owner') {
            throw Object.assign(new Error('Cannot change owner role'), { statusCode: 400 });
        }

        const targetMember = await prisma.workspaceMember.findUnique({
            where: { id: memberId },
            include: { user: { select: { name: true, email: true } } },
        });
        if (!targetMember) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

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

        return updated;
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
            throw Object.assign(new Error('Cannot remove owner from workspace'), { statusCode: 400 });
        }

        const memberToRemove = await prisma.workspaceMember.findUnique({
            where: { id: memberId },
            include: { user: { select: { name: true, email: true } } },
        });
        if (!memberToRemove) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

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
    }
}
