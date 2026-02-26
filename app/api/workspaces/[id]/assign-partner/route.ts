import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { verifyWorkspaceAccess, hasWorkspacePermission } from '@/lib/workspace/permissions';
import {
    findBestPartner,
    getPartnerEligibilityCriteria,
} from '@/lib/partners/assignment';

// POST /api/workspaces/[id]/assign-partner - Find and assign best matching partner
export const POST = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();

    // Use workspace permissions system for partner assignment
    const accessResult = await verifyWorkspaceAccess(user.email, workspaceId);
    if (!accessResult.allowed) {
        return apiError(403, accessResult.error || 'Access denied');
    }

    if (!hasWorkspacePermission(accessResult!.role, 'manageMembers')) {
        return apiError(403, 'Only workspace admins can assign partners');
    }

    // Get workspace with existing partner assignment
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { partnerAssignment: true },
    });

    if (!workspace) {
        return apiError(404, 'Workspace not found');
    }

    if (workspace.partnerAssignment) {
        return apiError(409, 'Workspace already has a partner assigned');
    }

    // Find eligible partners
    const eligiblePartners = await prisma.partner.findMany({
        where: getPartnerEligibilityCriteria(),
        include: {
            assignments: {
                where: { status: { in: ['ACCEPTED', 'ACTIVE'] } },
            },
        },
    });

    if (eligiblePartners.length === 0) {
        return apiError(404, 'No partners available at this time. Please try again later.');
    }

    const bestMatch = await findBestPartner(workspace as unknown as Parameters<typeof findBestPartner>[0], eligiblePartners);
    if (!bestMatch) {
        return apiError(404, 'No suitable partner found for your workspace.');
    }

    const assignment = await prisma.partnerAssignment.create({
        data: {
            partnerId: bestMatch.partner.id,
            workspaceId: workspace.id,
            status: 'PENDING',
            revenueSplit: 0.5,
        },
        include: {
            partner: {
                select: {
                    id: true,
                    companyName: true,
                    bio: true,
                    logo: true,
                    certificationLevel: true,
                    averageRating: true,
                    totalReviews: true,
                },
            },
        },
    });

    return apiSuccess({
        assignment,
        matchScore: Math.round(bestMatch.score),
        matchBreakdown: bestMatch.breakdown,
        message: 'Partner assigned successfully! They will be notified and can accept or decline.',
    });
});
