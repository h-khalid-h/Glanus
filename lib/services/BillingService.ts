/**
 * BillingService — Platform billing management for super-admin.
 *
 * Responsibilities:
 *  - Revenue metrics (MRR, subscription counts, plan distribution)
 *  - Payment history with filtering/pagination
 *  - Billing event timeline
 *  - Plan configuration CRUD
 *  - Manual plan overrides for workspaces
 */

import { prisma } from '@/lib/db';
import { dashboardCache } from '@/lib/cache';
import { PLAN_LIMITS } from '@/lib/services/WorkspaceService';
import { logInfo } from '@/lib/logger';
import type { SubscriptionPlan } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RevenueMetrics {
    mrr: number; // Monthly Recurring Revenue in cents
    totalRevenue: number; // All-time revenue in cents
    activeSubscriptions: number;
    pastDueSubscriptions: number;
    canceledThisMonth: number;
    newSubscriptionsThisMonth: number;
    planDistribution: Record<string, number>;
    revenueByMonth: { month: string; revenue: number; count: number }[];
}

export interface PaymentRecord {
    id: string;
    workspaceId: string;
    workspaceName: string;
    amount: number;
    currency: string;
    status: string;
    plan: string | null;
    description: string | null;
    invoiceUrl: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    failureReason: string | null;
    paidAt: Date | null;
    createdAt: Date;
}

export interface PaymentListResult {
    payments: PaymentRecord[];
    total: number;
}

export interface BillingEventRecord {
    id: string;
    workspaceId: string | null;
    workspaceName: string | null;
    type: string;
    description: string;
    previousPlan: string | null;
    newPlan: string | null;
    amount: number | null;
    actorType: string;
    createdAt: Date;
}

export interface PlanConfigRecord {
    id: string;
    plan: string;
    name: string;
    description: string | null;
    highlighted: boolean;
    stripePriceId: string | null;
    stripePriceIdPublic: string | null;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    maxAssets: number;
    maxAICreditsPerMonth: number;
    maxStorageMB: number;
    maxMembers: number;
    features: string[] | null;
    isActive: boolean;
    sortOrder: number;
}

export interface UpdatePlanConfigInput {
    name?: string;
    description?: string;
    highlighted?: boolean;
    stripePriceId?: string;
    stripePriceIdPublic?: string;
    priceMonthly?: number;
    priceYearly?: number;
    currency?: string;
    maxAssets?: number;
    maxAICreditsPerMonth?: number;
    maxStorageMB?: number;
    maxMembers?: number;
    features?: string[];
    isActive?: boolean;
    sortOrder?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class BillingService {

    // =========================================================================
    // REVENUE METRICS
    // =========================================================================

    static async getRevenueMetrics(): Promise<RevenueMetrics> {
        const cacheKey = 'billing:revenue-metrics';
        const cached = dashboardCache.get<RevenueMetrics>(cacheKey);
        if (cached) return cached;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            activeSubscriptions,
            pastDueSubscriptions,
            planCounts,
            canceledThisMonth,
            newThisMonth,
            totalRevenueResult,
            monthlyRevenue,
        ] = await Promise.all([
            prisma.subscription.count({ where: { status: 'ACTIVE', plan: { not: 'FREE' } } }),
            prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
            prisma.subscription.groupBy({
                by: ['plan'],
                _count: true,
                where: { status: { in: ['ACTIVE', 'TRIALING'] } },
            }),
            prisma.billingEvent.count({
                where: { type: 'subscription_canceled', createdAt: { gte: startOfMonth } },
            }),
            prisma.billingEvent.count({
                where: { type: 'checkout_completed', createdAt: { gte: startOfMonth } },
            }),
            prisma.payment.aggregate({
                where: { status: 'SUCCEEDED' },
                _sum: { amount: true },
            }),
            prisma.$queryRaw<{ month: string; revenue: bigint; count: bigint }[]>`
                SELECT
                    TO_CHAR(DATE_TRUNC('month', "paidAt"), 'YYYY-MM') AS month,
                    COALESCE(SUM(amount), 0)::bigint AS revenue,
                    COUNT(*)::bigint AS count
                FROM "Payment"
                WHERE status = 'SUCCEEDED' AND "paidAt" IS NOT NULL
                    AND "paidAt" > NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', "paidAt")
                ORDER BY month ASC
            `,
        ]);

        // Calculate MRR from active paid subscriptions by looking at plan configs
        const planConfigs = await prisma.planConfig.findMany({
            where: { isActive: true },
        });
        const priceMap = new Map(planConfigs.map(pc => [pc.plan, pc.priceMonthly]));

        let mrr = 0;
        for (const pc of planCounts) {
            if (pc.plan !== 'FREE') {
                mrr += (priceMap.get(pc.plan) || 0) * pc._count;
            }
        }

        const planDistribution: Record<string, number> = {};
        for (const pc of planCounts) {
            planDistribution[pc.plan] = pc._count;
        }

        const result: RevenueMetrics = {
            mrr,
            totalRevenue: totalRevenueResult._sum.amount || 0,
            activeSubscriptions,
            pastDueSubscriptions,
            canceledThisMonth,
            newSubscriptionsThisMonth: newThisMonth,
            planDistribution,
            revenueByMonth: monthlyRevenue.map(r => ({
                month: r.month,
                revenue: Number(r.revenue),
                count: Number(r.count),
            })),
        };

        dashboardCache.set(cacheKey, result, 60_000); // 60s cache
        return result;
    }

    // =========================================================================
    // PAYMENT HISTORY
    // =========================================================================

    static async getPayments(
        page = 1,
        limit = 20,
        filters?: { status?: string; workspaceId?: string }
    ): Promise<PaymentListResult> {
        const skip = (page - 1) * limit;
        const where: Record<string, unknown> = {};
        if (filters?.status) where.status = filters.status;
        if (filters?.workspaceId) where.workspaceId = filters.workspaceId;

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    workspace: { select: { name: true } },
                },
            }),
            prisma.payment.count({ where }),
        ]);

        return {
            payments: payments.map(p => ({
                id: p.id,
                workspaceId: p.workspaceId,
                workspaceName: p.workspace.name,
                amount: p.amount,
                currency: p.currency,
                status: p.status,
                plan: p.plan,
                description: p.description,
                invoiceUrl: p.invoiceUrl,
                periodStart: p.periodStart,
                periodEnd: p.periodEnd,
                failureReason: p.failureReason,
                paidAt: p.paidAt,
                createdAt: p.createdAt,
            })),
            total,
        };
    }

    // =========================================================================
    // BILLING EVENTS
    // =========================================================================

    static async getBillingEvents(
        page = 1,
        limit = 30,
        filters?: { type?: string; workspaceId?: string }
    ): Promise<{ events: BillingEventRecord[]; total: number }> {
        const skip = (page - 1) * limit;
        const where: Record<string, unknown> = {};
        if (filters?.type) where.type = filters.type;
        if (filters?.workspaceId) where.workspaceId = filters.workspaceId;

        const [events, total] = await Promise.all([
            prisma.billingEvent.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    workspace: { select: { name: true } },
                },
            }),
            prisma.billingEvent.count({ where }),
        ]);

        return {
            events: events.map(e => ({
                id: e.id,
                workspaceId: e.workspaceId,
                workspaceName: e.workspace?.name ?? null,
                type: e.type,
                description: e.description,
                previousPlan: e.previousPlan,
                newPlan: e.newPlan,
                amount: e.amount,
                actorType: e.actorType,
                createdAt: e.createdAt,
            })),
            total,
        };
    }

    // =========================================================================
    // PLAN CONFIGURATION
    // =========================================================================

    static async getPlanConfigs(): Promise<PlanConfigRecord[]> {
        const configs = await prisma.planConfig.findMany({
            orderBy: { sortOrder: 'asc' },
        });

        return configs.map(c => ({
            id: c.id,
            plan: c.plan,
            name: c.name,
            description: c.description,
            highlighted: c.highlighted,
            stripePriceId: c.stripePriceId,
            stripePriceIdPublic: c.stripePriceIdPublic,
            priceMonthly: c.priceMonthly,
            priceYearly: c.priceYearly,
            currency: c.currency,
            maxAssets: c.maxAssets,
            maxAICreditsPerMonth: c.maxAICreditsPerMonth,
            maxStorageMB: c.maxStorageMB,
            maxMembers: c.maxMembers,
            features: c.features as string[] | null,
            isActive: c.isActive,
            sortOrder: c.sortOrder,
        }));
    }

    static async updatePlanConfig(
        plan: SubscriptionPlan,
        input: UpdatePlanConfigInput,
        adminId: string
    ): Promise<PlanConfigRecord> {
        const config = await prisma.planConfig.upsert({
            where: { plan },
            create: {
                plan,
                name: input.name || plan.charAt(0) + plan.slice(1).toLowerCase(),
                description: input.description,
                highlighted: input.highlighted ?? false,
                stripePriceId: input.stripePriceId,
                stripePriceIdPublic: input.stripePriceIdPublic,
                priceMonthly: input.priceMonthly ?? 0,
                priceYearly: input.priceYearly ?? 0,
                currency: input.currency ?? 'usd',
                maxAssets: input.maxAssets ?? PLAN_LIMITS[plan]?.maxAssets ?? 5,
                maxAICreditsPerMonth: input.maxAICreditsPerMonth ?? PLAN_LIMITS[plan]?.maxAICreditsPerMonth ?? 100,
                maxStorageMB: input.maxStorageMB ?? PLAN_LIMITS[plan]?.maxStorageMB ?? 1024,
                maxMembers: input.maxMembers ?? 1,
                features: input.features ?? [],
                isActive: input.isActive ?? true,
                sortOrder: input.sortOrder ?? 0,
            },
            update: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.highlighted !== undefined && { highlighted: input.highlighted }),
                ...(input.stripePriceId !== undefined && { stripePriceId: input.stripePriceId }),
                ...(input.stripePriceIdPublic !== undefined && { stripePriceIdPublic: input.stripePriceIdPublic }),
                ...(input.priceMonthly !== undefined && { priceMonthly: input.priceMonthly }),
                ...(input.priceYearly !== undefined && { priceYearly: input.priceYearly }),
                ...(input.currency !== undefined && { currency: input.currency }),
                ...(input.maxAssets !== undefined && { maxAssets: input.maxAssets }),
                ...(input.maxAICreditsPerMonth !== undefined && { maxAICreditsPerMonth: input.maxAICreditsPerMonth }),
                ...(input.maxStorageMB !== undefined && { maxStorageMB: input.maxStorageMB }),
                ...(input.maxMembers !== undefined && { maxMembers: input.maxMembers }),
                ...(input.features !== undefined && { features: input.features }),
                ...(input.isActive !== undefined && { isActive: input.isActive }),
                ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
            },
        });

        // Log billing event
        await prisma.billingEvent.create({
            data: {
                type: 'plan_config_updated',
                description: `Plan "${plan}" configuration updated by admin`,
                actorId: adminId,
                actorType: 'admin',
                metadata: input as Record<string, unknown>,
            },
        });

        logInfo(`[BILLING] Plan config updated: ${plan} by admin ${adminId}`);

        return {
            id: config.id,
            plan: config.plan,
            name: config.name,
            description: config.description,
            highlighted: config.highlighted,
            stripePriceId: config.stripePriceId,
            stripePriceIdPublic: config.stripePriceIdPublic,
            priceMonthly: config.priceMonthly,
            priceYearly: config.priceYearly,
            currency: config.currency,
            maxAssets: config.maxAssets,
            maxAICreditsPerMonth: config.maxAICreditsPerMonth,
            maxStorageMB: config.maxStorageMB,
            maxMembers: config.maxMembers,
            features: config.features as string[] | null,
            isActive: config.isActive,
            sortOrder: config.sortOrder,
        };
    }

    // =========================================================================
    // MANUAL PLAN OVERRIDE
    // =========================================================================

    static async overrideWorkspacePlan(
        workspaceId: string,
        newPlan: SubscriptionPlan,
        adminId: string,
        reason?: string
    ): Promise<void> {
        const subscription = await prisma.subscription.findUnique({
            where: { workspaceId },
            select: { plan: true, status: true },
        });

        if (!subscription) {
            throw new Error('Workspace has no subscription record');
        }

        const previousPlan = subscription.plan;
        const planKey = newPlan as keyof typeof PLAN_LIMITS;
        const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.FREE;

        await prisma.subscription.update({
            where: { workspaceId },
            data: {
                plan: newPlan,
                status: 'ACTIVE',
                maxAssets: limits.maxAssets,
                maxAICreditsPerMonth: limits.maxAICreditsPerMonth,
                maxStorageMB: limits.maxStorageMB,
            },
        });

        // Log the override
        await prisma.billingEvent.create({
            data: {
                workspaceId,
                type: 'manual_plan_override',
                description: reason || `Admin manually changed plan from ${previousPlan} to ${newPlan}`,
                previousPlan: previousPlan as SubscriptionPlan,
                newPlan,
                actorId: adminId,
                actorType: 'admin',
            },
        });

        logInfo(`[BILLING] Manual plan override: workspace ${workspaceId} ${previousPlan} → ${newPlan} by admin ${adminId}`);
    }

    // =========================================================================
    // RECORD PAYMENT (called from webhook)
    // =========================================================================

    static async recordPayment(data: {
        workspaceId: string;
        stripeInvoiceId?: string;
        stripePaymentIntentId?: string;
        stripeCustomerId?: string;
        amount: number;
        currency?: string;
        status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
        plan?: SubscriptionPlan;
        description?: string;
        invoiceUrl?: string;
        invoicePdf?: string;
        periodStart?: Date;
        periodEnd?: Date;
        failureReason?: string;
        paidAt?: Date;
    }): Promise<void> {
        // Upsert by stripeInvoiceId to avoid duplicates
        if (data.stripeInvoiceId) {
            await prisma.payment.upsert({
                where: { stripeInvoiceId: data.stripeInvoiceId },
                create: {
                    workspaceId: data.workspaceId,
                    stripeInvoiceId: data.stripeInvoiceId,
                    stripePaymentIntentId: data.stripePaymentIntentId,
                    stripeCustomerId: data.stripeCustomerId,
                    amount: data.amount,
                    currency: data.currency || 'usd',
                    status: data.status,
                    plan: data.plan,
                    description: data.description,
                    invoiceUrl: data.invoiceUrl,
                    invoicePdf: data.invoicePdf,
                    periodStart: data.periodStart,
                    periodEnd: data.periodEnd,
                    failureReason: data.failureReason,
                    paidAt: data.paidAt,
                },
                update: {
                    status: data.status,
                    failureReason: data.failureReason,
                    paidAt: data.paidAt,
                    amount: data.amount,
                },
            });
        } else {
            await prisma.payment.create({
                data: {
                    workspaceId: data.workspaceId,
                    stripePaymentIntentId: data.stripePaymentIntentId,
                    stripeCustomerId: data.stripeCustomerId,
                    amount: data.amount,
                    currency: data.currency || 'usd',
                    status: data.status,
                    plan: data.plan,
                    description: data.description,
                    invoiceUrl: data.invoiceUrl,
                    invoicePdf: data.invoicePdf,
                    periodStart: data.periodStart,
                    periodEnd: data.periodEnd,
                    failureReason: data.failureReason,
                    paidAt: data.paidAt,
                },
            });
        }
    }

    // =========================================================================
    // RECORD BILLING EVENT (called from webhook)
    // =========================================================================

    static async recordBillingEvent(data: {
        workspaceId?: string;
        type: string;
        description: string;
        previousPlan?: SubscriptionPlan;
        newPlan?: SubscriptionPlan;
        amount?: number;
        stripeEventId?: string;
        actorId?: string;
        actorType?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void> {
        await prisma.billingEvent.create({
            data: {
                workspaceId: data.workspaceId,
                type: data.type,
                description: data.description,
                previousPlan: data.previousPlan,
                newPlan: data.newPlan,
                amount: data.amount,
                stripeEventId: data.stripeEventId,
                actorId: data.actorId,
                actorType: data.actorType || 'system',
                metadata: data.metadata,
            },
        });
    }
}
