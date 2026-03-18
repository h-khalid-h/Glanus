import { prisma } from '@/lib/db';
import { getPlanFromPriceId } from '@/lib/stripe/client';
import { logInfo, logWarn } from '@/lib/logger';
import Stripe from 'stripe';

/**
 * StripeWebhookService — Domain layer for all Stripe webhook event handling.
 *
 * Responsibilities:
 *  - claimEvent: idempotency guard — atomically claims an event for processing
 *  - markProcessed / markFailed: update event state after handling
 *  - handleCheckoutCompleted: link Stripe customer/subscription IDs to workspace
 *  - handleSubscriptionUpdate: sync plan/status changes from Stripe
 *  - handleSubscriptionCanceled: downgrade workspace to FREE plan
 *  - handlePaymentSucceeded: reset monthly AI credits on renewal
 *  - handlePaymentFailed: mark subscription as PAST_DUE
 */
export class StripeWebhookService {

    /**
     * Atomically claim a Stripe event for processing (idempotency guard).
     * Returns false if the event was already processed (duplicate).
     */
    static async claimEvent(eventId: string, eventType: string): Promise<boolean> {
        try {
            const result = await prisma.stripeEvent.upsert({
                where: { eventId },
                create: { eventId, type: eventType, processed: false },
                update: {},
            });
            // If record already existed with processed=true, it was already handled
            return !result.processed;
        } catch {
            // P2002 unique constraint — another worker already claimed it
            return false;
        }
    }

    static async markProcessed(eventId: string): Promise<void> {
        await prisma.stripeEvent.update({
            where: { eventId },
            data: { processed: true },
        });
    }

    static async markFailed(eventId: string): Promise<void> {
        await prisma.stripeEvent.update({
            where: { eventId },
            data: { processed: false },
        }).catch(() => { }); // best-effort
    }

    static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
        const workspaceId = session.metadata?.workspaceId;
        if (!workspaceId) return;

        await prisma.subscription.update({
            where: { workspaceId },
            data: {
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                status: 'ACTIVE',
            },
        });

        logInfo(`[STRIPE] Checkout completed for workspace ${workspaceId}`);
    }

    static async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
        const workspaceId = subscription.metadata?.workspaceId;
        if (!workspaceId) return;

        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId ? getPlanFromPriceId(priceId) : 'FREE';

        const statusMap: Record<string, string> = {
            active: 'ACTIVE',
            past_due: 'PAST_DUE',
            canceled: 'CANCELED',
            unpaid: 'PAST_DUE',
            trialing: 'TRIALING',
        };

        await prisma.subscription.update({
            where: { workspaceId },
            data: {
                plan: plan as never, // Prisma enum
                status: (statusMap[subscription.status] || 'ACTIVE') as never,
                stripeSubscriptionId: subscription.id,
                // Stripe SDK v20: current_period_end is on the subscription object at runtime
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                currentPeriodEnd: new Date(((subscription as any).current_period_end as number) * 1000),
            },
        });

        logInfo(`[STRIPE] Subscription updated for workspace ${workspaceId}: ${plan}`);
    }

    static async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
        const workspaceId = subscription.metadata?.workspaceId;
        if (!workspaceId) return;

        await prisma.subscription.update({
            where: { workspaceId },
            data: {
                plan: 'FREE',
                status: 'CANCELED',
                stripeSubscriptionId: null,
                // Stripe SDK v20: current_period_end is on the subscription object at runtime
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                currentPeriodEnd: new Date(((subscription as any).current_period_end as number) * 1000),
                maxAssets: 5,
                maxAICreditsPerMonth: 100,
                maxStorageMB: 1024,
            },
        });

        logInfo(`[STRIPE] Subscription canceled for workspace ${workspaceId}`);
    }

    static async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
        // Stripe SDK v20: invoice.subscription is string|Subscription at runtime but may not be
        // directly typed on Stripe.Invoice — using as-any is the established workaround
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscriptionId = (invoice as any).subscription as string | null;
        if (!subscriptionId) return;

        const sub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
        });

        if (sub) {
            await prisma.subscription.update({
                where: { id: sub.id },
                data: { aiCreditsUsed: 0, status: 'ACTIVE' },
            });
            logInfo(`[STRIPE] Payment succeeded for subscription ${subscriptionId}`);
        }
    }

    static async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
        // Stripe SDK v20: invoice.subscription is string|Subscription at runtime but may not be
        // directly typed on Stripe.Invoice — using as-any is the established workaround
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscriptionId = (invoice as any).subscription as string | null;
        if (!subscriptionId) return;

        const sub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
        });

        if (sub) {
            await prisma.subscription.update({
                where: { id: sub.id },
                data: { status: 'PAST_DUE' },
            });
            logWarn(`[STRIPE] Payment failed for subscription ${subscriptionId}`);
        }
    }
}
