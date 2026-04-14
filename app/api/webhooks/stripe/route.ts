import { apiSuccess, apiError } from '@/lib/api/response';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/client';
import { logInfo, logError, logWarn } from '@/lib/logger';
import { StripeWebhookService } from '@/lib/services/StripeWebhookService';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 *
 * Thin HTTP edge — only responsible for:
 *  1. Validating Stripe signature
 *  2. Claiming the event (idempotency)
 *  3. Dispatching to StripeWebhookService handlers
 *  4. Marking event processed / failed
 */
export async function POST(request: Request) {
    if (!webhookSecret) {
        if (process.env.NODE_ENV === 'production') {
            logError('[STRIPE_WEBHOOK] STRIPE_WEBHOOK_SECRET is required in production');
            return apiError(500, 'Webhook processing not configured');
        }
        logWarn('[STRIPE_WEBHOOK] STRIPE_WEBHOOK_SECRET not configured — ignoring webhook');
        return apiError(503, 'Webhook processing not configured');
    }

    if (!stripe) {
        logError('[STRIPE_WEBHOOK] Stripe client not initialized — STRIPE_SECRET_KEY is missing');
        return apiError(503, 'Stripe not configured');
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

    const claimed = await StripeWebhookService.claimEvent(event.id, event.type);
    if (!claimed) {
        logInfo('[STRIPE_WEBHOOK] Duplicate event skipped', { eventId: event.id, type: event.type });
        return apiSuccess({ received: true, duplicate: true });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await StripeWebhookService.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await StripeWebhookService.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
                break;
            case 'customer.subscription.deleted':
                await StripeWebhookService.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
                break;
            case 'invoice.payment_succeeded':
                await StripeWebhookService.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
                break;
            case 'invoice.payment_failed':
                await StripeWebhookService.handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;
            case 'invoice.payment_action_required':
                await StripeWebhookService.handlePaymentActionRequired(event.data.object as Stripe.Invoice);
                break;
            default:
                logInfo(`[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`);
        }

        await StripeWebhookService.markProcessed(event.id);
        return apiSuccess({ received: true });
    } catch (error: unknown) {
        await StripeWebhookService.markFailed(event.id);
        logError('[STRIPE_WEBHOOK] Error processing event', error, { eventId: event.id, type: event.type });
        return apiError(500, 'Webhook processing failed');
    }
}
