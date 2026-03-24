import { apiSuccess, apiError } from '@/lib/api/response';
import { stripe, PLAN_PRICE_IDS } from '@/lib/stripe/client';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { checkoutSchema } from '@/lib/schemas/workspace.schemas';
import { withRateLimit } from '@/lib/security/rateLimit';
import { NextRequest } from 'next/server';

// POST /api/workspaces/[id]/checkout - Create Stripe Checkout session
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const { priceId } = checkoutSchema.parse(await request.json());

    // Validate priceId is one of the configured plan prices
    const allowedPriceIds = Object.values(PLAN_PRICE_IDS).filter(Boolean);
    if (!allowedPriceIds.includes(priceId)) {
        return apiError(400, 'Invalid price ID');
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
            workspaceId,
            userId: user.id,
        },
        subscription_data: {
            metadata: { workspaceId },
        },
        success_url: `${baseUrl}/workspaces/${workspaceId}/billing?status=success`,
        cancel_url: `${baseUrl}/workspaces/${workspaceId}/billing?status=canceled`,
    });

    return apiSuccess({ url: checkoutSession.url });
});
