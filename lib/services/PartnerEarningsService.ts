import { ApiError } from '@/lib/errors';
/**
 * PartnerEarningsService — Partner revenue dashboard, payout history, and Stripe Connect onboarding.
 *
 * Responsibilities:
 *  - getEarnings: compute current-month estimate, active workspace status, top earners
 *  - getPayouts: fetch payout history with stats (paid/pending/failed totals)
 *  - onboardStripe: create/resume Stripe Express account onboarding link
 *
 * Note: partner CRUD/directory lives in PartnerService,
 * exams in PartnerExamService, assignments in PartnerAssignmentService.
 */
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';

export class PartnerEarningsService {
    /**
     * Compute the earnings dashboard for the authenticated partner.
     * Estimates current-month revenue based on active workspace subscriptions
     * and each assignment's revenue-split percentage.
     */
    static async getEarnings(userEmail: string) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw new ApiError(404, 'Partner profile not found');
        }
        const partner = dbUser.partnerProfile;

        const assignments = await prisma.partnerAssignment.findMany({
            where: { partnerId: partner.id, status: { in: ['ACCEPTED', 'ACTIVE', 'COMPLETED'] } },
            include: {
                workspace: {
                    select: {
                        id: true, name: true, slug: true, logo: true,
                        subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
                    },
                },
            },
            orderBy: { assignedAt: 'desc' },
        });

        const planPrices: Record<string, number> = { FREE: 0, PERSONAL: 19, TEAM: 49, ENTERPRISE: 99 };
        const activeAssignments = assignments.filter(a => a.status === 'ACCEPTED' || a.status === 'ACTIVE');

        let currentMonthEstimate = 0;
        activeAssignments.forEach(a => {
            if (a.workspace.subscription?.status === 'ACTIVE') {
                const planPrice = planPrices[a.workspace.subscription.plan] || 0;
                currentMonthEstimate += planPrice * Number(a.revenueSplit);
            }
        });

        const topWorkspaces = assignments
            .sort((a, b) => Number(b.totalEarnings) - Number(a.totalEarnings))
            .slice(0, 5)
            .map(a => ({ workspace: a.workspace, totalEarnings: a.totalEarnings, status: a.status, assignedAt: a.assignedAt }));

        return {
            summary: {
                totalEarnings: partner.totalEarnings, currentMonthEstimate,
                activeWorkspaces: activeAssignments.length, totalWorkspaces: assignments.length,
                certificationLevel: partner.certificationLevel,
                maxWorkspaces: partner.maxWorkspaces, availableSlots: partner.availableSlots,
            },
            topWorkspaces, assignments, stripeConnected: partner.stripeOnboarded,
        };
    }

    /**
     * Retrieve payout history with aggregate stats (paid/pending/failed).
     */
    static async getPayouts(userEmail: string) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw new ApiError(404, 'Partner profile not found');
        }

        const payouts = await prisma.partnerPayout.findMany({
            where: { partnerId: dbUser.partnerProfile.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, amount: true, currency: true, periodStart: true, periodEnd: true,
                status: true, stripePayoutId: true, failureReason: true,
                workspaceCount: true, subscriptionDetails: true, createdAt: true, paidAt: true,
            },
        });

        const stats = {
            totalPaid: payouts.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0),
            pending: payouts.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING').reduce((sum, p) => sum + Number(p.amount), 0),
            failed: payouts.filter((p) => p.status === 'FAILED').length,
            total: payouts.length,
        };

        return { payouts, stats };
    }

    /**
     * Create or resume a Stripe Express account onboarding link.
     * Returns immediately if the partner is already onboarded.
     */
    static async onboardStripe(userEmail: string) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw new ApiError(404, 'Partner profile not found');
        }

        if (dbUser.partnerProfile.stripeOnboarded) {
            return { message: 'Stripe account already connected', stripeAccountId: dbUser.partnerProfile.stripeAccountId, alreadyOnboarded: true };
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        let stripeAccountId = dbUser.partnerProfile.stripeAccountId;

        if (!stripeAccountId) {
            const account = await stripe.accounts.create({
                type: 'express', email: dbUser.email,
                metadata: { partnerId: dbUser.partnerProfile.id, userId: dbUser.id },
                capabilities: { transfers: { requested: true } },
                business_type: 'individual',
            });
            stripeAccountId = account.id;
            await prisma.partner.update({ where: { id: dbUser.partnerProfile.id }, data: { stripeAccountId } });
        }

        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId!,
            refresh_url: `${baseUrl}/partners/earnings?stripe=refresh`,
            return_url: `${baseUrl}/partners/earnings?stripe=complete`,
            type: 'account_onboarding',
        });

        return { url: accountLink.url, stripeAccountId };
    }
}
