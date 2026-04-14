import { prisma } from '@/lib/db';
import { getPlanFromPriceIdAsync } from '@/lib/stripe/client';
import { logInfo, logWarn, logError } from '@/lib/logger';
import { PLAN_LIMITS } from '@/lib/services/WorkspaceService';
import { BillingService } from '@/lib/services/BillingService';
import { sendEmail } from '@/lib/email/sendgrid';
import { getPaymentSuccessEmailTemplate, getPaymentFailedEmailTemplate, getSubscriptionCanceledEmailTemplate, getPaymentActionRequiredEmailTemplate } from '@/lib/email/templates';
import Stripe from 'stripe';
import type { SubscriptionPlan, Prisma } from '@prisma/client';

/**
 * Valid subscription status transitions.
 * Each key maps to the set of statuses it is allowed to transition to.
 */
const VALID_STATUS_TRANSITIONS: Record<string, Set<string>> = {
    ACTIVE:   new Set(['PAST_DUE', 'CANCELED', 'UNPAID', 'ACTIVE']),
    TRIALING: new Set(['ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING']),
    PAST_DUE: new Set(['ACTIVE', 'CANCELED', 'UNPAID', 'PAST_DUE']),
    CANCELED: new Set(['ACTIVE', 'TRIALING', 'CANCELED']),
    UNPAID:   new Set(['ACTIVE', 'CANCELED', 'UNPAID']),
};

function isValidTransition(from: string, to: string): boolean {
    if (from === to) return true;
    return VALID_STATUS_TRANSITIONS[from]?.has(to) ?? false;
}

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

        // Resolve the plan from the subscription's price ID
        let plan: string = 'FREE';
        const subscriptionId = session.subscription as string | null;
        if (subscriptionId) {
            try {
                const { stripe: stripeClient } = await import('@/lib/stripe/client');
                const sub = await stripeClient.subscriptions.retrieve(subscriptionId);
                const priceId = sub.items.data[0]?.price?.id;
                if (priceId) {
                    plan = await getPlanFromPriceIdAsync(priceId);
                }
            } catch (err) {
                logWarn('[STRIPE] Could not retrieve subscription to resolve plan, defaulting to FREE', err instanceof Error ? { message: err.message } : undefined);
            }
        }

        const planKey = (plan || 'FREE') as keyof typeof PLAN_LIMITS;
        const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.FREE;

        await prisma.subscription.update({
            where: { workspaceId },
            data: {
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: subscriptionId,
                plan: plan as never,
                status: 'ACTIVE',
                maxAssets: limits.maxAssets,
                maxAICreditsPerMonth: limits.maxAICreditsPerMonth,
                maxStorageMB: limits.maxStorageMB,
            },
        });

        // Record billing event
        await BillingService.recordBillingEvent({
            workspaceId,
            type: 'checkout_completed',
            description: `Checkout completed — plan set to ${plan}, Stripe customer ${session.customer}`,
            stripeEventId: session.id,
        }).catch(err => logError('[STRIPE] Failed to record billing event', err));

        logInfo(`[STRIPE] Checkout completed for workspace ${workspaceId}, plan: ${plan}`);
    }

    static async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
        const workspaceId = subscription.metadata?.workspaceId;
        if (!workspaceId) return;

        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId ? await getPlanFromPriceIdAsync(priceId) : 'FREE';

        const statusMap: Record<string, string> = {
            active: 'ACTIVE',
            past_due: 'PAST_DUE',
            canceled: 'CANCELED',
            unpaid: 'PAST_DUE', // Mapping 'unpaid' to PAST_DUE for safety, though UNPAID exists
            trialing: 'TRIALING',
            incomplete: 'PAST_DUE',
            incomplete_expired: 'CANCELED',
            paused: 'CANCELED'
        };

        const newStatus = statusMap[subscription.status];
        if (!newStatus) {
             logWarn(`[STRIPE] Unrecognized subscription status '${subscription.status}' for workspace ${workspaceId}. Downgrading for safety.`);
             // Safe default instead of assuming ACTIVE
             return;
        }

        // Validate status transition
        const current = await prisma.subscription.findUnique({
            where: { workspaceId },
            select: { status: true },
        });

        if (current && !isValidTransition(current.status, newStatus)) {
            logWarn(`[STRIPE] Invalid status transition ${current.status} → ${newStatus} for workspace ${workspaceId}, skipping`);
            return;
        }

        const planKey = (plan || 'FREE') as keyof typeof PLAN_LIMITS;
        const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.FREE;

        const previousPlan = current?.status ? undefined : 'FREE';

        // Use Prisma interactive transaction to group subscription update and billing event log
        await prisma.$transaction(async (tx) => {
            await tx.subscription.update({
                where: { workspaceId },
                data: {
                    plan: plan as never, // Prisma enum
                    status: newStatus as never,
                    stripeSubscriptionId: subscription.id,
                    maxAssets: limits.maxAssets,
                    maxAICreditsPerMonth: limits.maxAICreditsPerMonth,
                    maxStorageMB: limits.maxStorageMB,
                    currentPeriodStart: (subscription as Stripe.Subscription & { current_period_start?: number }).current_period_start
                        ? new Date(((subscription as Stripe.Subscription & { current_period_start: number }).current_period_start) * 1000)
                        : undefined,
                    currentPeriodEnd: new Date(((subscription as Stripe.Subscription & { current_period_end: number }).current_period_end) * 1000),
                },
            });

            await tx.billingEvent.create({
                data: {
                    workspaceId,
                    type: 'plan_change',
                    description: `Subscription updated to ${plan} (${newStatus})`,
                    previousPlan: previousPlan as SubscriptionPlan | undefined,
                    newPlan: plan as SubscriptionPlan,
                    actorType: 'system',
                },
            });
        }).catch(err => logError('[STRIPE] Failed to process subscription update transaction', err));

        logInfo(`[STRIPE] Subscription updated for workspace ${workspaceId}: ${plan} (${newStatus})`);
    }

    static async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
        const workspaceId = subscription.metadata?.workspaceId;
        if (!workspaceId) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
            ? new Date(((subscription as Stripe.Subscription & { current_period_end: number }).current_period_end) * 1000)
            : new Date();

        await prisma.$transaction(async (tx) => {
            await tx.subscription.update({
                where: { workspaceId },
                data: {
                    plan: 'FREE',
                    status: 'CANCELED',
                    stripeSubscriptionId: null,
                    currentPeriodEnd: periodEnd,
                    maxAssets: PLAN_LIMITS.FREE.maxAssets,
                    maxAICreditsPerMonth: PLAN_LIMITS.FREE.maxAICreditsPerMonth,
                    maxStorageMB: PLAN_LIMITS.FREE.maxStorageMB,
                },
            });

            await tx.billingEvent.create({
                data: {
                    workspaceId,
                    type: 'subscription_canceled',
                    description: `Subscription canceled, access until ${periodEnd.toISOString().split('T')[0]}`,
                    newPlan: 'FREE' as SubscriptionPlan,
                    actorType: 'system',
                },
            });
        }).catch(err => logError('[STRIPE] Failed to process subscription cancellation transaction', err));

        logInfo(`[STRIPE] Subscription canceled for workspace ${workspaceId}`);

        // Send cancellation email to workspace owner
        try {
            const workspace = await prisma.workspace.findFirst({
                where: { id: workspaceId },
                include: { owner: { select: { name: true, email: true } } },
            });
            if (workspace?.owner?.email) {
                await sendEmail({
                    to: workspace.owner.email,
                    subject: `Subscription canceled for ${workspace.name}`,
                    html: getSubscriptionCanceledEmailTemplate(
                        workspace.owner.name || 'there',
                        workspace.name,
                        periodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    ),
                });
            }
        } catch (emailErr) {
            logError('[STRIPE] Failed to send cancellation email', emailErr);
        }
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
            if (!isValidTransition(sub.status, 'ACTIVE')) {
                logWarn(`[STRIPE] Invalid status transition ${sub.status} → ACTIVE on payment success for ${subscriptionId}, skipping`);
                return;
            }
            await prisma.$transaction(async (tx) => {
                await tx.subscription.update({
                    where: { id: sub.id },
                    data: { aiCreditsUsed: 0, status: 'ACTIVE' },
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const paymentIntentId = (invoice as any).payment_intent as string | undefined;

                // Persist payment record
                if (invoice.id) {
                    await tx.payment.upsert({
                        where: { stripeInvoiceId: invoice.id },
                        create: {
                            workspaceId: sub.workspaceId,
                            stripeInvoiceId: invoice.id,
                            stripePaymentIntentId: paymentIntentId,
                            stripeCustomerId: sub.stripeCustomerId ?? undefined,
                            amount: invoice.amount_paid ?? 0,
                            currency: invoice.currency ?? 'usd',
                            status: 'SUCCEEDED',
                            plan: sub.plan as SubscriptionPlan,
                            description: `Invoice payment for ${sub.plan} plan`,
                            invoiceUrl: invoice.hosted_invoice_url ?? null,
                            periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
                            periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
                            paidAt: new Date(),
                        },
                        update: { status: 'SUCCEEDED', paidAt: new Date(), amount: invoice.amount_paid ?? 0 },
                    });
                } else {
                    await tx.payment.create({
                        data: {
                            workspaceId: sub.workspaceId,
                            stripePaymentIntentId: paymentIntentId,
                            stripeCustomerId: sub.stripeCustomerId ?? undefined,
                            amount: invoice.amount_paid ?? 0,
                            currency: invoice.currency ?? 'usd',
                            status: 'SUCCEEDED',
                            plan: sub.plan as SubscriptionPlan,
                            description: `Invoice payment for ${sub.plan} plan`,
                            paidAt: new Date(),
                        }
                    });
                }

                await tx.billingEvent.create({
                    data: {
                        workspaceId: sub.workspaceId,
                        type: 'payment_succeeded',
                        description: `Payment of $${((invoice.amount_paid ?? 0) / 100).toFixed(2)} succeeded`,
                        amount: invoice.amount_paid ?? 0,
                        actorType: 'system'
                    }
                });
            }).catch(err => logError('[STRIPE] Failed payment success transaction', err));

            logInfo(`[STRIPE] Payment succeeded for subscription ${subscriptionId}`);

            // Send payment success email to workspace owner
            try {
                const workspace = await prisma.workspace.findFirst({
                    where: { subscription: { id: sub.id } },
                    include: { owner: { select: { name: true, email: true } }, subscription: { select: { plan: true } } },
                });
                if (workspace?.owner?.email) {
                    const amount = invoice.amount_paid ? `$${(invoice.amount_paid / 100).toFixed(2)}` : 'N/A';
                    await sendEmail({
                        to: workspace.owner.email,
                        subject: `Payment received for ${workspace.name}`,
                        html: getPaymentSuccessEmailTemplate(
                            workspace.owner.name || 'there',
                            workspace.name,
                            workspace.subscription?.plan || 'Unknown',
                            amount
                        ),
                    });
                }
            } catch (emailErr) {
                logError('[STRIPE] Failed to send payment success email', emailErr);
            }
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
            if (!isValidTransition(sub.status, 'PAST_DUE')) {
                logWarn(`[STRIPE] Invalid status transition ${sub.status} → PAST_DUE on payment failure for ${subscriptionId}, skipping`);
                return;
            }
            await prisma.$transaction(async (tx) => {
                await tx.subscription.update({
                    where: { id: sub.id },
                    data: { status: 'PAST_DUE' },
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const paymentIntentId = (invoice as any).payment_intent as string | undefined;

                if (invoice.id) {
                    await tx.payment.upsert({
                        where: { stripeInvoiceId: invoice.id },
                        create: {
                            workspaceId: sub.workspaceId,
                            stripeInvoiceId: invoice.id,
                            stripePaymentIntentId: paymentIntentId,
                            stripeCustomerId: sub.stripeCustomerId ?? undefined,
                            amount: invoice.amount_due ?? 0,
                            currency: invoice.currency ?? 'usd',
                            status: 'FAILED',
                            plan: sub.plan as SubscriptionPlan,
                            description: `Failed payment for ${sub.plan} plan`,
                            failureReason: 'Payment method declined or insufficient funds',
                        },
                        update: { status: 'FAILED', failureReason: 'Payment method declined or insufficient funds' },
                    });
                } else {
                    await tx.payment.create({
                        data: {
                            workspaceId: sub.workspaceId,
                            stripePaymentIntentId: paymentIntentId,
                            stripeCustomerId: sub.stripeCustomerId ?? undefined,
                            amount: invoice.amount_due ?? 0,
                            currency: invoice.currency ?? 'usd',
                            status: 'FAILED',
                            plan: sub.plan as SubscriptionPlan,
                            description: `Failed payment for ${sub.plan} plan`,
                            failureReason: 'Payment method declined or insufficient funds',
                        }
                    });
                }

                await tx.billingEvent.create({
                    data: {
                        workspaceId: sub.workspaceId,
                        type: 'payment_failed',
                        description: `Payment of $${((invoice.amount_due ?? 0) / 100).toFixed(2)} failed`,
                        amount: invoice.amount_due ?? 0,
                        actorType: 'system'
                    }
                });
            }).catch(err => logError('[STRIPE] Failed payment failed transaction', err));

            logWarn(`[STRIPE] Payment failed for subscription ${subscriptionId}`);

            // Send payment failed email to workspace owner
            try {
                const workspace = await prisma.workspace.findFirst({
                    where: { subscription: { id: sub.id } },
                    include: { owner: { select: { name: true, email: true } } },
                });
                if (workspace?.owner?.email) {
                    const amount = invoice.amount_due ? `$${(invoice.amount_due / 100).toFixed(2)}` : 'N/A';
                    await sendEmail({
                        to: workspace.owner.email,
                        subject: `Payment failed for ${workspace.name}`,
                        html: getPaymentFailedEmailTemplate(
                            workspace.owner.name || 'there',
                            workspace.name,
                            amount
                        ),
                    });
                }
            } catch (emailErr) {
                logError('[STRIPE] Failed to send payment failed email', emailErr);
            }
        }
    }

    static async handlePaymentActionRequired(invoice: Stripe.Invoice): Promise<void> {
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
            logWarn(`[STRIPE] Payment action required for subscription ${subscriptionId}`);

            // Record billing event
            await BillingService.recordBillingEvent({
                workspaceId: sub.workspaceId,
                type: 'payment_action_required',
                description: `Action (like 3D Secure) required for payment of $${((invoice.amount_due ?? 0) / 100).toFixed(2)}`,
                amount: invoice.amount_due ?? 0,
            }).catch(err => logError('[STRIPE] Failed to record billing event', err));

            // Send notification
            try {
                const workspace = await prisma.workspace.findFirst({
                    where: { subscription: { id: sub.id } },
                    include: { owner: { select: { name: true, email: true } } },
                });
                if (workspace?.owner?.email && invoice.hosted_invoice_url) {
                    await sendEmail({
                        to: workspace.owner.email,
                        subject: `Action Required: Payment for ${workspace.name}`,
                        html: getPaymentActionRequiredEmailTemplate(
                            workspace.owner.name || 'there',
                            workspace.name,
                            invoice.hosted_invoice_url
                        ),
                    });
                }
            } catch (emailErr) {
                logError('[STRIPE] Failed to send payment action required email', emailErr);
            }
        }
    }
}
