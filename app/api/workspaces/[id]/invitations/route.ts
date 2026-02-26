import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { requireAuth, requireWorkspaceAccess, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email/sendgrid';
import { getInvitationEmailTemplate } from '@/lib/email/templates';

const inviteSchema = z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

// GET /api/workspaces/[id]/invitations - List pending invitations
export const GET = withErrorHandler(async (
    _request: Request,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const invitations = await prisma.workspaceInvitation.findMany({
        where: { workspaceId, status: 'PENDING' },
        include: {
            inviter: {
                select: { id: true, name: true, email: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({ invitations });
});

// POST /api/workspaces/[id]/invitations - Send invitation (ADMIN or higher)
export const POST = withErrorHandler(async (
    request: Request,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    const { workspace } = await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    // Validate request
    const body = await request.json();
    const validation = inviteSchema.safeParse(body);
    if (!validation.success) {
        return apiError(400, 'Validation failed', validation.error.errors);
    }

    const { email, role } = validation.data;

    // Check if user already exists in workspace
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        const existingMembership = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: existingUser.id,
                },
            },
        });

        if (existingMembership) {
            return apiError(409, 'User is already a member of this workspace');
        }
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.workspaceInvitation.findFirst({
        where: { workspaceId, email, status: 'PENDING' },
    });

    if (existingInvitation) {
        return apiError(409, 'Invitation already sent to this email');
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex');

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.workspaceInvitation.create({
        data: {
            workspaceId,
            email,
            role,
            token,
            invitedBy: user.id,
            expiresAt,
        },
        include: {
            workspace: { select: { name: true } },
            inviter: { select: { name: true, email: true } },
        },
    });

    // Send invitation email (non-blocking)
    try {
        const inviterName = invitation.inviter?.name || invitation.inviter?.email || 'Someone';
        const inviteUrl = `${process.env.NEXTAUTH_URL}/invitations/${token}`;
        await sendEmail({
            to: email,
            subject: `You've been invited to join ${workspace.name} on Glanus`,
            html: getInvitationEmailTemplate(inviterName, workspace.name, inviteUrl),
        });
    } catch (error: unknown) {
        logError('Failed to send invitation email', error);
    }

    return apiSuccess({
        invitation,
        start_url: `${process.env.NEXTAUTH_URL}/invitations/${token}`,
    }, undefined, 201);
});
