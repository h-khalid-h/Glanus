import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiDeleted } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { TicketService, updateTicketSchema } from '@/lib/services/TicketService';

/**
 * GET /api/workspaces/[id]/tickets/[ticketId]
 * Fetch a single ticket with its full message thread.
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; ticketId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId, ticketId } = await context.params;
    const auth = await requireWorkspaceAccess(workspaceId, user.id, request);

    const ticket = await TicketService.getTicketById(workspaceId, ticketId, user, auth);
    return apiSuccess({ ticket });
});

/**
 * PATCH /api/workspaces/[id]/tickets/[ticketId]
 * Update ticket status, priority, or assignee.
 */
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; ticketId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId, ticketId } = await context.params;
    const auth = await requireWorkspaceAccess(workspaceId, user.id, request);

    const data = updateTicketSchema.parse(await request.json());
    const updatedTicket = await TicketService.updateTicket(workspaceId, ticketId, user, auth, data);
    return apiSuccess({ ticket: updatedTicket }, { message: 'Ticket updated successfully' });
});

/**
 * DELETE /api/workspaces/[id]/tickets/[ticketId]
 * Permanently delete a ticket (admin/IT staff only).
 */
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; ticketId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId, ticketId } = await context.params;
    const auth = await requireWorkspaceAccess(workspaceId, user.id, request);

    await TicketService.deleteTicket(workspaceId, ticketId, user, auth);
    return apiDeleted();
});
