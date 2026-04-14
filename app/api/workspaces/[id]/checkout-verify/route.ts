import { apiSuccess, apiError } from '@/lib/api/response';
import { stripe, getPlanFromPriceIdAsync } from '@/lib/stripe/client';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { prisma } from '@/lib/db';
import { PLAN_LIMITS } from '@/lib/services/WorkspaceService';
import { logInfo, logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import type { SubscriptionPlan } from '@prisma/client';

/**
 * POST /api/workspaces/[id]/checkout-verify
 *
 * Called after Stripe redirects back to the app on success.
 * Looks up the most recent completed checkout session for this workspace,
 * then syncs the subscription + records a payment in the DB.
 * This ensures the plan is applied even if the webhook hasn't arrived yet
 * (common in local dev or when webhook delivery is delayed).
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    if (!stripe) {
        return apiError(503, 'Stripe not configured');
    }

    // Get current subscription record
    const subscription = await prisma.subscription.findUnique({
        where: { workspaceId },
        select: { id: true, stripeSubscriptionId: true, stripeCustomerId: true, plan: true, status: true },
    });

    if (!subscription) {
        return apiError(404, 'No subscription record found for this workspace');
    }

    // If we already have a stripeSubscriptionId, verify directly with Stripe
    if (subscription.stripeSubscriptionId) {
        const result = await syncSubscriptionFromStripe(workspaceId, subscription.stripeSubscriptionId);
        return apiSuccess(result);
    }

    // No stripeSubscriptionId yet (webhook hasn't arrived) — search Stripe checkout sessions
    // Look for completed checkout sessions with this workspaceId in metadata
    const sessions = await stripe.checkout.sessions.list({
        limit: 10,
    });

    const matchingSession = sessions.data.find(
        s => s.metadata?.workspaceId === workspaceId
            && s.status === 'complete'
            && s.subscription
    );

    if (!matchingSession) {
        return apiError(404, 'No completed checkout session found for this workspace. Payment may still be processing.');
    }

    const stripeCustomerId = matchingSession.customer as string;
    const stripeSubscriptionId = matchingSession.subscription as string;

    // First, save the Stripe IDs from the checkout session (this is what the webhook would have done)
    await prisma.subscription.update({
        where: { workspaceId },
        data: {
            stripeCustomerId,
            stripeSubscriptionId,
            status: 'ACTIVE',
        },
    });

    // Now sync the full subscription details (plan, limits, payment record)
    const result = await syncSubscriptionFromStripe(workspaceId, stripeSubscriptionId);

    // Record the checkout event if not already recorded
    await prisma.billingEvent.create({
        data: {
            workspaceId,
            type: 'checkout_completed',
            description: `Checkout verified — plan set to ${result.plan}, Stripe customer ${stripeCustomerId}`,
            actorType: 'system',
        },
    }).catch(() => { /* billing event may already exist from webhook */ });

    return apiSuccess(result);
});

/**
 * Sync subscription state from Stripe to DB.
 * Updates plan, status, limits, and creates a payment record if one doesn't exist.
 */
async function syncSubscriptionFromStripe(
    workspaceId: string,
    stripeSubscriptionId: string
): Promise<{ plan: string; status: string }> {
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['latest_invoice'],
    });

    const priceId = stripeSub.items.data[0]?.price?.id;
    const plan = priceId ? await getPlanFromPriceIdAsync(priceId) : 'FREE';
    const planKey = (plan || 'FREE') as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.FREE;

    const statusMap: Record<string, string> = {
        active: 'ACTIVE',
        past_due: 'PAST_DUE',
        canceled: 'CANCELED',
        unpaid: 'PAST_DUE',
        trialing: 'TRIALING',
        incomplete: 'PAST_DUE',
        incomplete_expired: 'CANCELED',
        paused: 'CANCELED',
    };
    const status = statusMap[stripeSub.status] || 'ACTIVE';

    // Update subscription in DB
    await prisma.subscription.update({
        where: { workspaceId },
        data: {
            plan: plan as never,
            status: status as never,
            maxAssets: limits.maxAssets,
            maxAICreditsPerMonth: limits.maxAICreditsPerMonth,
            maxStorageMB: limits.maxStorageMB,
        },
    });

    // Record payment if latest invoice is paid and we don't already have it
    const invoice = stripeSub.latest_invoice;
    if (invoice && typeof invoice === 'object' && invoice.status === 'paid') {
        try {
            const existingPayment = await prisma.payment.findFirst({
                where: { stripeInvoiceId: invoice.id },
            });
            if (!existingPayment) {
                await prisma.payment.create({
                    data: {
                        workspaceId,
                        stripeInvoiceId: invoice.id,
                        stripePaymentIntentId: typeof (invoice as unknown as Record<string, unknown>).payment_intent === 'string' ? (invoice as unknown as Record<string, unknown>).payment_intent as string : undefined,
                        stripeCustomerId: typeof stripeSub.customer === 'string' ? stripeSub.customer : undefined,
                        amount: invoice.amount_paid ?? 0,
                        currency: invoice.currency ?? 'usd',
                        status: 'SUCCEEDED',
                        plan: plan as SubscriptionPlan,
                        description: `Invoice payment for ${plan} plan`,
                        invoiceUrl: invoice.hosted_invoice_url ?? null,
                        paidAt: new Date(),
                    },
                });

                await prisma.billingEvent.create({
                    data: {
                        workspaceId,
                        type: 'payment_succeeded',
                        description: `Payment of $${((invoice.amount_paid ?? 0) / 100).toFixed(2)} verified`,
                        amount: invoice.amount_paid ?? 0,
                        actorType: 'system',
                    },
                });
            }
        } catch (err) {
            logError('[CHECKOUT_VERIFY] Failed to record payment', err);
        }
    }

    logInfo(`[CHECKOUT_VERIFY] Synced subscription for workspace ${workspaceId}: ${plan} (${status})`);
    return { plan, status };
}
