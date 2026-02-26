import { apiSuccess, apiError } from '@/lib/api/response';
import { headers } from 'next/headers';
import { stripe, getPlanFromPriceId } from '@/lib/stripe/client';
import { prisma } from '@/lib/db';
import { logInfo, logError, logWarn } from '@/lib/logger';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
    if (!webhookSecret) {
        if (process.env.NODE_ENV === 'production') {
            logError('[STRIPE_WEBHOOK] STRIPE_WEBHOOK_SECRET is required in production');
            return apiError(500, 'Webhook processing not configured');
        }
        logWarn('[STRIPE_WEBHOOK] STRIPE_WEBHOOK_SECRET not configured — ignoring webhook');
        return apiError(503, 'Webhook processing not configured');
    }

    const body = await request.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature') || '';

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: unknown) {
        logError('[STRIPE_WEBHOOK] Signature verification failed', err);
        return apiError(400, 'Webhook signature verification failed');
    }

    // Idempotency check: skip already-processed events
    const existingEvent = await prisma.stripeEvent.findUnique({
        where: { eventId: event.id },
    });

    if (existingEvent) {
        logInfo('[STRIPE_WEBHOOK] Duplicate event skipped', { eventId: event.id, type: event.type });
        return apiSuccess({ received: true, duplicate: true });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session);
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdate(subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionCanceled(subscription);
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentSucceeded(invoice);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentFailed(invoice);
                break;
            }

            default:
                logInfo(`[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`);
        }

        // Record processed event for idempotency
        await prisma.stripeEvent.create({
            data: {
                eventId: event.id,
                type: event.type,
                processed: true,
            },
        });

        return apiSuccess({ received: true });
    } catch (error: unknown) {
        logError('[STRIPE_WEBHOOK] Error processing event', error, { eventId: event.id, type: event.type });
        return apiError(500, 'Webhook processing failed');
    }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const workspaceId = session.metadata?.workspaceId;
    if (!workspaceId) return;

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    // Update subscription with Stripe IDs (stripeCustomerId lives on Subscription now)
    await prisma.subscription.update({
        where: { workspaceId },
        data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: 'ACTIVE',
        },
    });

    logInfo(`[STRIPE] Checkout completed for workspace ${workspaceId}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
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
            plan: plan as any, // Prisma enum
            status: (statusMap[subscription.status] || 'ACTIVE') as any, // Prisma enum
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000), // Stripe SDK gap
        },
    });

    logInfo(`[STRIPE] Subscription updated for workspace ${workspaceId}: ${plan}`);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const workspaceId = subscription.metadata?.workspaceId;
    if (!workspaceId) return;

    // Downgrade to free plan
    await prisma.subscription.update({
        where: { workspaceId },
        data: {
            plan: 'FREE',
            status: 'CANCELED',
            stripeSubscriptionId: null,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000), // Stripe SDK gap
            maxAssets: 5,
            maxAICreditsPerMonth: 100,
            maxStorageMB: 1024,
        },
    });

    logInfo(`[STRIPE] Subscription canceled for workspace ${workspaceId}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const subscriptionId = (invoice as any).subscription as string; // Stripe SDK gap
    if (!subscriptionId) return;

    // Find workspace by stripe subscription ID
    const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
    });

    if (sub) {
        // Reset monthly AI credits on successful payment
        await prisma.subscription.update({
            where: { id: sub.id },
            data: {
                aiCreditsUsed: 0,
                status: 'ACTIVE',
            },
        });

        logInfo(`[STRIPE] Payment succeeded for subscription ${subscriptionId}`);
    }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = (invoice as any).subscription as string; // Stripe SDK gap
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
