import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { createRemoteSessionSchema } from '@/lib/schemas/remote-session.schemas';
import { RemoteSessionService } from '@/lib/services/RemoteSessionService';

// GET /api/remote/sessions
export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const result = await RemoteSessionService.getSessions({
        userId: user.id,
        status: searchParams.get('status') || undefined,
        assetId: searchParams.get('assetId') || undefined,
        filterUserId: searchParams.get('userId') || undefined,
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '20'),
    });

    return apiSuccess(result);
});

// POST /api/remote/sessions
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

    try {
        const session = await RemoteSessionService.createSession({
            userId: user.id,
            assetId: parsed.data.assetId,
            notes: parsed.data.notes,
            offer: parsed.data.offer as Record<string, unknown> | undefined,
        });
        return apiSuccess(session, undefined, 201);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Failed to create session');
    }
});
