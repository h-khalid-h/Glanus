import { ApiError } from '@/lib/errors';
/**
 * TicketService — IT support ticket and messaging management.
 *
 * Responsibilities:
 *  - getTickets: list workspace tickets with role-aware access enforcement
 *  - getTicketById: fetch full ticket with message thread
 *  - createTicket / updateTicket / deleteTicket: lifecycle management
 *  - addMessage: append replies or internal notes with access enforcement
 */
import { prisma } from '@/lib/db';
import { Prisma, $Enums } from '@prisma/client';
import { z } from 'zod';

export const createTicketSchema = z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().min(5, 'Description is too short').max(10000, 'Description is too long'),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    assetId: z.string().optional()
});

export const updateTicketSchema = z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    assigneeId: z.string().nullable().optional()
});

export const createMessageSchema = z.object({
    content: z.string().min(1, 'Message cannot be empty').max(10000, 'Message is too long'),
    isInternal: z.boolean().default(false)
});

interface UserAuthContext {
    id: string;
    role: string;
}

interface WorkspaceAuthContext {
    role: string;
}

export class TicketService {
    /**
     * Fetch a paginated or filtered list of tickets for a specific workspace.
     */
    static async getTickets(
        workspaceId: string,
        user: UserAuthContext,
        auth: WorkspaceAuthContext,
        filters: { status?: string | null, priority?: string | null, assigneeId?: string | null }
    ) {
        // Build typed where clause to avoid loose `any` for Prisma query filter
        const where: Prisma.TicketWhereInput = { workspaceId };

        if (filters.status) where.status = filters.status as $Enums.TicketStatus;
        if (filters.priority) where.priority = filters.priority as $Enums.TicketPriority;
        if (filters.assigneeId) where.assigneeId = filters.assigneeId;

        // Non IT_STAFF / ADMINs only see their own tickets
        if (auth.role !== 'ADMIN' && auth.role !== 'OWNER' && user.role !== 'IT_STAFF') {
            where.creatorId = user.id;
        }

        const tickets = await prisma.ticket.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                creator: { select: { id: true, name: true, email: true } },
                assignee: {
                    select: {
                        id: true,
                        user: { select: { name: true, email: true } }
                    }
                },
                asset: { select: { id: true, name: true, assetType: true } },
                _count: { select: { messages: true } }
            }
        });

        return tickets;
    }

    /**
     * Create a new support ticket.
     */
    static async createTicket(
        workspaceId: string,
        user: UserAuthContext,
        data: z.infer<typeof createTicketSchema>
    ) {
        let asset = null;
        if (data.assetId) {
            asset = await prisma.asset.findFirst({
                where: { id: data.assetId, workspaceId },
                select: { id: true }
            });
            if (!asset) throw new ApiError(400, 'Invalid asset selection');
        }

        const ticket = await prisma.ticket.create({
            data: {
                workspaceId,
                title: data.title,
                description: data.description,
                priority: data.priority,
                assetId: asset?.id || null,
                creatorId: user.id
            },
            include: {
                creator: { select: { name: true, email: true } }
            }
        });

        // Auto-create initial message representing the ticket body
        await prisma.ticketMessage.create({
            data: {
                ticketId: ticket.id,
                senderId: user.id,
                content: ticket.description,
                isInternal: false
            }
        });

        return ticket;
    }

    /**
     * Fetch a single ticket by ID with its messages.
     */
    static async getTicketById(
        workspaceId: string,
        ticketId: string,
        user: UserAuthContext,
        auth: WorkspaceAuthContext
    ) {
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId, workspaceId },
            include: {
                creator: { select: { id: true, name: true, email: true } },
                assignee: {
                    select: {
                        id: true,
                        user: { select: { name: true, email: true } }
                    }
                },
                asset: { select: { id: true, name: true, assetType: true } },
                messages: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        sender: { select: { id: true, name: true, email: true, role: true } }
                    }
                }
            }
        });

        if (!ticket) throw new ApiError(404, 'Ticket not found');

        // Access enforcement
        if (auth.role !== 'ADMIN' && auth.role !== 'OWNER' && user.role !== 'IT_STAFF') {
            if (ticket.creatorId !== user.id) {
                throw new ApiError(403, 'Access denied to this ticket');
            }
        }

        return ticket;
    }

    /**
     * Update administrative or status properties of a ticket.
     */
    static async updateTicket(
        workspaceId: string,
        ticketId: string,
        user: UserAuthContext,
        auth: WorkspaceAuthContext,
        data: z.infer<typeof updateTicketSchema>
    ) {
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId, workspaceId },
            select: { id: true, status: true, creatorId: true }
        });

        if (!ticket) throw new ApiError(404, 'Ticket not found');

        // Only IT_STAFF, ADMIN, or OWNER can reassign or change priority
        if (auth.role !== 'ADMIN' && auth.role !== 'OWNER' && user.role !== 'IT_STAFF') {
            if (ticket.creatorId !== user.id) throw new ApiError(403, 'Access denied to this ticket');

            // Basic users shouldn't re-assign tickets or change priority, only status (e.g., closing it)
            if (data.assigneeId !== undefined || data.priority !== undefined) {
                throw new ApiError(403, 'Permission denied to modify ticket administrative properties');
            }
        }

        // Handle Assignee Validation if modifying
        if (data.assigneeId) {
            const validMember = await prisma.workspaceMember.findUnique({
                where: { id: data.assigneeId }
            });
            if (!validMember || validMember.workspaceId !== workspaceId) {
                throw new ApiError(400, 'Invalid assignee selected');
            }
        }

        const resolvedAt = data.status && ['RESOLVED', 'CLOSED'].includes(data.status) && !['RESOLVED', 'CLOSED'].includes(ticket.status)
            ? new Date()
            : undefined;

        const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: {
                ...data,
                resolvedAt
            }
        });

        return updatedTicket;
    }

    /**
     * Delete a single ticket permanently.
     */
    static async deleteTicket(
        workspaceId: string,
        ticketId: string,
        user: UserAuthContext,
        auth: WorkspaceAuthContext
    ) {
        if (auth.role !== 'ADMIN' && auth.role !== 'OWNER' && user.role !== 'IT_STAFF') {
            throw new ApiError(403, 'Insufficient permissions to delete tickets');
        }

        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId, workspaceId }
        });

        if (!ticket) throw new ApiError(404, 'Ticket not found');

        await prisma.ticket.delete({
            where: { id: ticketId }
        });

        return true;
    }

    /**
     * Append a new conversational reply or internal note to a ticket thread.
     */
    static async addMessage(
        workspaceId: string,
        ticketId: string,
        user: UserAuthContext,
        auth: WorkspaceAuthContext,
        data: z.infer<typeof createMessageSchema>
    ) {
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId, workspaceId },
            select: { id: true, creatorId: true, status: true, assigneeId: true }
        });

        if (!ticket) throw new ApiError(404, 'Ticket not found');

        const isPrivileged = auth.role === 'ADMIN' || auth.role === 'OWNER' || user.role === 'IT_STAFF';

        // Access enforcement: Normal users can only reply to their own tickets and cannot post internal notes
        if (!isPrivileged) {
            if (ticket.creatorId !== user.id) {
                throw new ApiError(403, 'Access denied to this ticket');
            }
            if (data.isInternal) {
                throw new ApiError(403, 'Permission denied for internal messages');
            }
        }

        const [message] = await prisma.$transaction([
            prisma.ticketMessage.create({
                data: {
                    ticketId: ticket.id,
                    senderId: user.id,
                    content: data.content,
                    isInternal: data.isInternal
                },
                include: {
                    sender: { select: { id: true, name: true, email: true, role: true } }
                }
            }),
            prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    status: (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') ? 'OPEN' : ticket.status,
                    updatedAt: new Date()
                }
            })
        ]);

        return message;
    }
}
