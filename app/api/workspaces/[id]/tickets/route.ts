import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { TicketService, createTicketSchema } from '@/lib/services/TicketService';

/**
 * GET /api/workspaces/[id]/tickets
 * List tickets for a workspace (role-aware — regular users see only their own).
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    const auth = await requireWorkspaceAccess(workspaceId, user.id, request);

    const url = new URL(request.url);
    const filters = {
        status: url.searchParams.get('status'),
        priority: url.searchParams.get('priority'),
        assigneeId: url.searchParams.get('assigneeId'),
    };

    const tickets = await TicketService.getTickets(workspaceId, user, auth, filters);
    return apiSuccess({ tickets });
});

/**
 * POST /api/workspaces/[id]/tickets
 * Create a new support ticket.
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceAccess(workspaceId, user.id, request);

    const data = createTicketSchema.parse(await request.json());
    const ticket = await TicketService.createTicket(workspaceId, user, data);
    return apiSuccess(ticket, { message: 'Ticket created successfully' }, 201);
});
