import { apiSuccess, apiError } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';
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

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }
    const { priceId } = parsed.data;

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
