import { logWarn } from '@/lib/logger';
/**
 * Stripe Server-Side Client
 * Configures and exports Stripe SDK for backend use
 */
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    logWarn('STRIPE_SECRET_KEY is not set. Billing features will be disabled.');
}

export const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2026-02-25.clover',
        typescript: true,
    })
    : null as unknown as Stripe;

/**
 * Env-based price IDs — legacy fallback only.
 * Prefer getPlanPriceIds() which reads from PlanConfig DB table first.
 */
const ENV_PLAN_PRICE_IDS: Record<string, string> = {
    PERSONAL: process.env.STRIPE_PRICE_PERSONAL || '',
    TEAM: process.env.STRIPE_PRICE_TEAM || '',
    ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE || '',
};

/** @deprecated Use getPlanPriceIds() instead */
export const PLAN_PRICE_IDS = ENV_PLAN_PRICE_IDS;

/**
 * Load plan price IDs from PlanConfig DB table, falling back to env vars.
 * Results are cached for the lifetime of the request.
 */
let _cachedPriceIds: Record<string, string> | null = null;
let _cachedAt = 0;
const CACHE_TTL = 60_000; // 60s

export async function getPlanPriceIds(): Promise<Record<string, string>> {
    if (_cachedPriceIds && Date.now() - _cachedAt < CACHE_TTL) {
        return _cachedPriceIds;
    }
    try {
        // Dynamic import to avoid circular deps at module load time
        const { prisma } = await import('@/lib/db');
        const configs = await prisma.planConfig.findMany({
            where: { isActive: true, OR: [{ stripePriceId: { not: null } }, { stripePriceIdPublic: { not: null } }] },
            select: { plan: true, stripePriceId: true, stripePriceIdPublic: true },
        });
        if (configs.length > 0) {
            const map: Record<string, string> = {};
            for (const c of configs) {
                // Prefer stripePriceIdPublic (what the client sends) with fallback to stripePriceId
                const id = c.stripePriceIdPublic || c.stripePriceId;
                if (id) map[c.plan] = id;
            }
            _cachedPriceIds = map;
            _cachedAt = Date.now();
            return map;
        }
    } catch {
        // DB not available — fall back to env
    }
    return ENV_PLAN_PRICE_IDS;
}

/**
 * Map Stripe price IDs back to plan names.
 * Checks both stripePriceId and stripePriceIdPublic from DB, then falls back to env.
 */
export async function getPlanFromPriceIdAsync(priceId: string): Promise<string> {
    // First check the cached map (populated from stripePriceIdPublic || stripePriceId)
    const ids = await getPlanPriceIds();
    for (const [plan, id] of Object.entries(ids)) {
        if (id === priceId) return plan;
    }
    // If not found, do a direct DB lookup against both columns (handles mismatched public vs server IDs)
    try {
        const { prisma } = await import('@/lib/db');
        const config = await prisma.planConfig.findFirst({
            where: {
                isActive: true,
                OR: [
                    { stripePriceId: priceId },
                    { stripePriceIdPublic: priceId },
                ],
            },
            select: { plan: true },
        });
        if (config) return config.plan;
    } catch {
        // DB not available
    }
    return 'FREE';
}

/**
 * Synchronous fallback — uses env vars only.
 * @deprecated Prefer getPlanFromPriceIdAsync()
 */
export function getPlanFromPriceId(priceId: string): string {
    for (const [plan, id] of Object.entries(ENV_PLAN_PRICE_IDS)) {
        if (id === priceId) return plan;
    }
    return 'FREE';
}
