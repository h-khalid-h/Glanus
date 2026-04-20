import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { z } from 'zod';

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/admin/workspaces/[workspaceId]/billing
 * Returns billing history: payments + billing events, paginated.
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const { workspaceId } = await params;

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
    });
    if (!workspace) {
        throw new ApiError(404, 'Workspace not found');
    }

    const url = new URL(request.url);
    const { page, limit } = querySchema.parse({
        page: url.searchParams.get('page') ?? 1,
        limit: url.searchParams.get('limit') ?? 20,
    });

    const skip = (page - 1) * limit;

    const [payments, paymentsTotal, billingEvents, eventsTotal] = await Promise.all([
        prisma.payment.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                amount: true,
                currency: true,
                status: true,
                plan: true,
                description: true,
                invoiceUrl: true,
                invoicePdf: true,
                periodStart: true,
                periodEnd: true,
                failureReason: true,
                paidAt: true,
                createdAt: true,
            },
        }),
        prisma.payment.count({ where: { workspaceId } }),
        prisma.billingEvent.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                type: true,
                description: true,
                previousPlan: true,
                newPlan: true,
                amount: true,
                currency: true,
                actorType: true,
                createdAt: true,
            },
        }),
        prisma.billingEvent.count({ where: { workspaceId } }),
    ]);

    return apiSuccess({
        payments,
        paymentsMeta: {
            total: paymentsTotal,
            page,
            limit,
            totalPages: Math.ceil(paymentsTotal / limit) || 1,
        },
        billingEvents,
        eventsMeta: {
            total: eventsTotal,
            page,
            limit,
            totalPages: Math.ceil(eventsTotal / limit) || 1,
        },
    });
});
