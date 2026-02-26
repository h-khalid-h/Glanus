import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { updateRemoteSessionSchema } from '@/lib/schemas/remote-session.schemas';

// GET /api/remote/sessions/[id] - Get session details
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    const remoteSession = await prisma.remoteSession.findFirst({
        where: {
            id,
            asset: {
                workspace: {
                    members: { some: { userId: user.id } },
                },
            },
        },
        include: {
            asset: { select: { id: true, name: true, category: true, status: true, location: true } },
            user: { select: { id: true, name: true, email: true, role: true } },
        },
    });

    if (!remoteSession) return apiError(404, 'Session not found');

    return apiSuccess(remoteSession);
});

// PUT /api/remote/sessions/[id] - Update session
export const PUT = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    const body = await request.json();
    const parsed = updateRemoteSessionSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }
    const { quality, notes, status, metadata, averageLatency, averageFPS, offer, answer, iceCandidates } = parsed.data;

    const updateData: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma dynamic update
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
        const existingSession = await prisma.remoteSession.findUnique({ where: { id }, select: { iceCandidates: true } });
        const existingCandidates = (existingSession?.iceCandidates as any[]) || []; // Prisma JSON array
        updateData.iceCandidates = [...existingCandidates, ...iceCandidates];
    }

    if (status === 'ENDED') {
        const currentSession = await prisma.remoteSession.findUnique({
            where: { id },
            select: { startedAt: true },
        });
        if (currentSession) {
            const duration = Math.floor((Date.now() - new Date(currentSession.startedAt).getTime()) / 1000);
            updateData.duration = duration;
            updateData.endedAt = new Date();
        }
    }

    const updatedSession = await prisma.remoteSession.update({
        where: { id },
        data: updateData,
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
                resourceId: id,
                userId: user.id,
                assetId: updatedSession.assetId,
                metadata: { duration: updateData.duration, quality, averageLatency, averageFPS },
            },
        });
    }

    return apiSuccess(updatedSession);
});

// DELETE /api/remote/sessions/[id] - End/delete session
export const DELETE = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();

    const remoteSession = await prisma.remoteSession.findUnique({
        where: { id },
        select: { startedAt: true, assetId: true },
    });

    if (!remoteSession) return apiError(404, 'Session not found');

    const duration = Math.floor((Date.now() - new Date(remoteSession.startedAt).getTime()) / 1000);

    await prisma.remoteSession.update({
        where: { id },
        data: { status: 'ENDED', endedAt: new Date(), duration },
    });

    await prisma.auditLog.create({
        data: {
            action: 'REMOTE_SESSION_DELETED',
            resourceType: 'RemoteSession',
            resourceId: id,
            userId: user.id,
            assetId: remoteSession.assetId,
            metadata: { duration },
        },
    });

    return apiSuccess({ message: 'Session ended successfully' });
});
