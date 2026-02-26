import { apiSuccess, apiError } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { withErrorHandler } from '@/lib/api/withAuth';
import { auditLog } from '@/lib/workspace/auditLog';

// POST /api/invitations/[token]/accept - Accept workspace invitation
export const POST = withErrorHandler(async (
    request: Request,
    context: { params: Promise<{ token: string }> }
) => {
    // Rate limit to prevent brute-force token enumeration
    const rateLimitResponse = await withRateLimit(request as unknown as import('next/server').NextRequest, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return apiError(401, 'You must be signed in to accept an invitation');
    }

    const params = await context.params;
    // Find invitation
    const invitation = await prisma.workspaceInvitation.findUnique({
        where: { token: params.token },
        include: {
            workspace: true,
        },
    });

    if (!invitation) {
        return apiError(404, 'Invitation not found');
    }

    // Verify the logged-in user's email matches the invitation
    if (invitation.email.toLowerCase() !== session.user.email!.toLowerCase()) {
        return apiError(403, 'This invitation was sent to a different email address');
    }

    // Check status
    if (invitation.status !== 'PENDING') {
        return apiError(400, 'Invitation already used or revoked');
    }

    // Check expiration
    if (new Date() > invitation.expiresAt) {
        // Auto-expire
        await prisma.workspaceInvitation.update({
            where: { id: invitation.id },
            data: { status: 'EXPIRED' },
        });
        return apiError(400, 'Invitation expired');
    }

    // Get or create user
    let user = await prisma.user.findUnique({
        where: { email: invitation.email },
    });

    if (!user) {
        // For MVP, return error. In production, would create account or require signup
        return apiError(404, 'Account not found. Please sign up first.');
    }

    // Check if already a member
    const existingMembership = await prisma.workspaceMember.findUnique({
        where: {
            workspaceId_userId: {
                workspaceId: invitation.workspaceId,
                userId: user.id,
            },
        },
    });

    if (existingMembership) {
        return apiError(409, 'Already a member of this workspace');
    }

    // Create membership in transaction
    const result = await prisma.$transaction(async (tx) => {
        // Create membership
        const membership = await tx.workspaceMember.create({
            data: {
                workspaceId: invitation.workspaceId,
                userId: user.id,
                role: invitation.role,
            },
        });

        // Mark invitation as accepted
        await tx.workspaceInvitation.update({
            where: { id: invitation.id },
            data: {
                status: 'ACCEPTED',
                acceptedAt: new Date(),
            },
        });

        return membership;
    });

    // Audit log: member joined workspace via invitation
    await auditLog({
        workspaceId: invitation.workspaceId,
        userId: user.id,
        action: 'member.invited',
        resourceType: 'WorkspaceMember',
        resourceId: result.id,
        details: {
            role: invitation.role,
            invitedBy: invitation.invitedBy,
            acceptedVia: 'invitation_link',
        },
    });

    return apiSuccess({
        success: true,
        workspace: invitation.workspace,
        membership: result,
        message: `You've joined ${invitation.workspace.name}!`,
    });
});
