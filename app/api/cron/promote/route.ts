import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { withCronHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';

/**
 * POST /api/cron/promote
 * One-time admin promotion endpoint, protected by CRON_SECRET.
 *
 * Usage: curl -X POST https://glanus.datac.com/api/cron/promote \
 *   -H "Authorization: Bearer <CRON_SECRET>" \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"h.khalid@datac.com"}'
 */
export const POST = withCronHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
        return apiError(400, 'Email is required');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return apiError(404, 'User not found');
    }

    if (user.role === 'ADMIN') {
        return apiSuccess({ message: 'User is already an ADMIN', user: { id: user.id, email: user.email, role: user.role } });
    }

    const updated = await prisma.user.update({
        where: { email },
        data: { role: 'ADMIN' },
        select: { id: true, email: true, name: true, role: true },
    });

    return apiSuccess({ message: 'User promoted to ADMIN', user: updated });
});
