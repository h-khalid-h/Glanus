/**
 * RemoteSessionService — WebRTC remote access session lifecycle.
 *
 * Responsibilities:
 *  - getSessions: list sessions with workspace-scoped pagination + filters
 *  - createSession: initiate session with conflict detection + audit log
 *  - getSessionById: fetch single session (workspace membership guard)
 *  - updateSession: ICE candidate appending, status transitions, duration tracking
 *  - endSession: terminate session with duration computation + audit log
 *
 * Extracted to sibling service:
 *  - RemoteSignalingService → verifySignalingAccess / getSignalingState / patchSignalingState
 */
import { prisma } from '@/lib/db';
import { hashAgentToken } from '@/lib/security/agent-auth';

// ============================================
// INPUT TYPES
// ============================================

export interface CreateSessionInput {
    userId: string;
    assetId: string;
    notes?: string;
    offer?: Record<string, unknown>;
}

export interface UpdateSessionInput {
    quality?: string;
    notes?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    averageLatency?: number;
    averageFPS?: number;
    offer?: Record<string, unknown>;
    answer?: Record<string, unknown>;
    iceCandidates?: unknown[];
}

export interface SessionFilters {
    userId: string;
    status?: string;
    assetId?: string;
    filterUserId?: string;
    page?: number;
    limit?: number;
}

// ============================================
// REMOTE SESSION SERVICE
// ============================================

/**
 * RemoteSessionService — Domain layer for WebRTC remote session lifecycle.
 *
 * Encapsulates:
 *   - Session listing with workspace-scoped pagination
 *   - Session creation with conflict detection and audit logging
 *   - Session update (ICE candidate appending, status transitions, duration tracking)
 *   - Session termination with audit log
 *   - Signaling channel read/write (dual auth: user + agent bearer token)
 */
export class RemoteSessionService {

    // ========================================
    // LIST SESSIONS
    // ========================================

    static async getSessions(filters: SessionFilters) {
        const { userId, status, assetId, filterUserId, page = 1, limit = 20 } = filters;
        const safeLimi = Math.min(limit, 50);
        const skip = (page - 1) * safeLimi;

        const where: Record<string, unknown> = {
            asset: { workspace: { members: { some: { userId } } } },
        };
        if (status) where.status = status;
        if (assetId) where.assetId = assetId;
        if (filterUserId) where.userId = filterUserId;

        const [sessions, total] = await Promise.all([
            prisma.remoteSession.findMany({
                where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic Prisma where
                include: {
                    asset: { select: { id: true, name: true, category: true, status: true } },
                    user: { select: { id: true, name: true, email: true, role: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: safeLimi,
            }),
            prisma.remoteSession.count({ where: where as any }), // eslint-disable-line @typescript-eslint/no-explicit-any
        ]);

        return { sessions, pagination: { total, page, limit: safeLimi, pages: Math.ceil(total / safeLimi) } };
    }

    // ========================================
    // CREATE SESSION
    // ========================================

    static async createSession(input: CreateSessionInput) {
        // Verify asset access
        const asset = await prisma.asset.findFirst({
            where: {
                id: input.assetId,
                workspace: { members: { some: { userId: input.userId } } },
            },
        });
        if (!asset) {
            throw Object.assign(new Error('Asset not found or access denied'), { statusCode: 404 });
        }

        // Conflict detection — prevent duplicate active sessions
        const activeSession = await prisma.remoteSession.findFirst({
            where: { assetId: input.assetId, status: 'ACTIVE' },
        });
        if (activeSession) {
            throw Object.assign(new Error('An active session already exists for this asset'), { statusCode: 409 });
        }

        const session = await prisma.remoteSession.create({
            data: {
                userId: input.userId,
                assetId: input.assetId,
                status: 'ACTIVE',
                notes: input.notes,
                offer: input.offer ? (input.offer as object) : undefined,
            },
            include: {
                asset: { select: { id: true, name: true, category: true, status: true } },
                user: { select: { id: true, name: true, email: true, role: true } },
            },
        });

        await prisma.auditLog.create({
            data: {
                action: 'REMOTE_SESSION_STARTED',
                resourceType: 'RemoteSession',
                resourceId: session.id,
                userId: input.userId,
                assetId: input.assetId,
                metadata: { sessionId: session.id },
            },
        });

        return session;
    }

    // ========================================
    // GET SESSION BY ID
    // ========================================

    static async getSessionById(sessionId: string, userId: string) {
        const session = await prisma.remoteSession.findFirst({
            where: {
                id: sessionId,
                asset: { workspace: { members: { some: { userId } } } },
            },
            include: {
                asset: { select: { id: true, name: true, category: true, status: true, location: true } },
                user: { select: { id: true, name: true, email: true, role: true } },
            },
        });
        if (!session) {
            throw Object.assign(new Error('Session not found'), { statusCode: 404 });
        }
        return session;
    }

    // ========================================
    // UPDATE SESSION
    // ========================================

    static async updateSession(sessionId: string, userId: string, updates: UpdateSessionInput) {
        const { quality, notes, status, metadata, averageLatency, averageFPS, offer, answer, iceCandidates } = updates;

        const updateData: Record<string, unknown> = {};
        if (quality !== undefined) updateData.quality = quality;
        if (notes !== undefined) updateData.notes = notes;
        if (status !== undefined) updateData.status = status;
        if (metadata !== undefined) updateData.metadata = metadata;
        if (averageLatency !== undefined) updateData.averageLatency = averageLatency;
        if (averageFPS !== undefined) updateData.averageFPS = averageFPS;
        if (offer !== undefined) updateData.offer = offer;
        if (answer !== undefined) updateData.answer = answer;

        // Append ICE candidates rather than overwrite
        if (iceCandidates !== undefined && iceCandidates.length > 0) {
            const existing = await prisma.remoteSession.findUnique({
                where: { id: sessionId },
                select: { iceCandidates: true },
            });
            const existingCandidates = (existing?.iceCandidates as unknown[]) || [];
            updateData.iceCandidates = [...existingCandidates, ...iceCandidates];
        }

        if (status === 'ENDED') {
            const current = await prisma.remoteSession.findUnique({
                where: { id: sessionId },
                select: { startedAt: true },
            });
            if (current) {
                updateData.duration = Math.floor((Date.now() - new Date(current.startedAt).getTime()) / 1000);
                updateData.endedAt = new Date();
            }
        }

        const updated = await prisma.remoteSession.update({
            where: { id: sessionId },
            data: updateData as Parameters<typeof prisma.remoteSession.update>[0]['data'],
            include: {
                asset: { select: { id: true, name: true, category: true, status: true } },
                user: { select: { id: true, name: true, email: true, role: true } },
            },
        });

        if (status === 'ENDED') {
            await prisma.auditLog.create({
                data: {
                    action: 'REMOTE_SESSION_ENDED',
                    resourceType: 'RemoteSession',
                    resourceId: sessionId,
                    userId,
                    assetId: updated.assetId,
                    metadata: { duration: updateData.duration, quality, averageLatency, averageFPS },
                },
            });
        }

        return updated;
    }

    // ========================================
    // END SESSION (DELETE)
    // ========================================

    static async endSession(sessionId: string, userId: string) {
        const session = await prisma.remoteSession.findUnique({
            where: { id: sessionId },
            select: { startedAt: true, assetId: true },
        });
        if (!session) {
            throw Object.assign(new Error('Session not found'), { statusCode: 404 });
        }

        const duration = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);

        await prisma.remoteSession.update({
            where: { id: sessionId },
            data: { status: 'ENDED', endedAt: new Date(), duration },
        });

        await prisma.auditLog.create({
            data: {
                action: 'REMOTE_SESSION_DELETED',
                resourceType: 'RemoteSession',
                resourceId: sessionId,
                userId,
                assetId: session.assetId,
                metadata: { duration },
            },
        });
    }
}

