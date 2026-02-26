import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { createRemoteSessionSchema } from '@/lib/schemas/remote-session.schemas';

// GET /api/remote/sessions - List remote sessions with filtering
export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const assetId = searchParams.get('assetId') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;

    const where: any = { // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma dynamic where
        // Scope to assets in user's workspaces
        asset: {
            workspace: {
                members: { some: { userId: user.id } },
            },
        },
    };
    if (status) where.status = status;
    if (assetId) where.assetId = assetId;
    if (userId) where.userId = userId;

    const [sessions, total] = await Promise.all([
        prisma.remoteSession.findMany({
            where,
            include: {
                asset: { select: { id: true, name: true, category: true, status: true } },
                user: { select: { id: true, name: true, email: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.remoteSession.count({ where }),
    ]);

    return apiSuccess({
        sessions,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
});

// POST /api/remote/sessions - Create new remote session
export const POST = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    if (user.role !== 'ADMIN' && user.role !== 'IT_STAFF') {
        return apiError(403, 'Forbidden - Insufficient permissions');
    }

    const body = await request.json();
    const parsed = createRemoteSessionSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }
    const { assetId, notes, offer } = parsed.data;

    // Verify asset exists AND user has workspace access
    const asset = await prisma.asset.findFirst({
        where: {
            id: assetId,
            workspace: {
                members: { some: { userId: user.id } },
            },
        },
    });
    if (!asset) return apiError(404, 'Asset not found or access denied');

    const activeSession = await prisma.remoteSession.findFirst({
        where: { assetId, status: 'ACTIVE' },
    });
    if (activeSession) return apiError(409, 'An active session already exists for this asset');

    const remoteSession = await prisma.remoteSession.create({
        data: {
            userId: user.id,
            assetId,
            status: 'ACTIVE',
            notes,
            offer: offer ? (offer as any) : undefined,  // Prisma JSON field
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
            resourceId: remoteSession.id,
            userId: user.id,
            assetId,
            metadata: { sessionId: remoteSession.id },
        },
    });

    return apiSuccess(remoteSession, undefined, 201);
});
