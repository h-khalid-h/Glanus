import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { TicketService, createTicketSchema } from '@/lib/services/TicketService';
import { z } from 'zod';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        const user = await requireAuth();
        const params = await (context.params instanceof Promise ? context.params : Promise.resolve(context.params));
        const auth = await requireWorkspaceAccess(params.id, user.id, request);

        const url = new URL(request.url);
        const filters = {
            status: url.searchParams.get('status'),
            priority: url.searchParams.get('priority'),
            assigneeId: url.searchParams.get('assigneeId')
        };

        const tickets = await TicketService.getTickets(params.id, user, auth, filters);
        return apiSuccess({ tickets });

    } catch (error: any) {
        if (error.message === 'Unauthorized') return apiError(403, 'Unauthorized');
        return apiError(500, 'Failed to fetch tickets', error.message);
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        const user = await requireAuth();
        const params = await (context.params instanceof Promise ? context.params : Promise.resolve(context.params));
        const _auth = await requireWorkspaceAccess(params.id, user.id, request);

        const body = await request.json();
        const data = createTicketSchema.parse(body);

        const ticket = await TicketService.createTicket(params.id, user, data);

        return apiSuccess(ticket, { message: 'Ticket created successfully', status: 201 });

    } catch (error: any) {
        if (error instanceof z.ZodError) return apiError(400, 'Invalid payload', error.errors);
        if (error.message === 'Unauthorized') return apiError(403, 'Unauthorized');
        if (error.message === 'Invalid asset selection') return apiError(400, error.message);
        return apiError(500, 'Failed to create ticket', error.message);
    }
}
