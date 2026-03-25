import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { TicketService, createMessageSchema } from '@/lib/services/TicketService';

/**
 * POST /api/workspaces/[id]/tickets/[ticketId]/messages
 * Append a reply or internal note to a ticket thread.
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; ticketId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId, ticketId } = await context.params;
    const auth = await requireWorkspaceAccess(workspaceId, user.id, request);

    const data = createMessageSchema.parse(await request.json());
    const message = await TicketService.addMessage(workspaceId, ticketId, user, auth, data);
    return apiSuccess({ message }, { message: 'Message sent' }, 201);
});
