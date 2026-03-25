import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { prisma } from '@/lib/db';

/**
 * POST /api/admin/promote
 * One-time admin promotion endpoint, protected by CRON_SECRET.
 * 
 * Usage: curl -X POST https://glanus.datac.com/api/admin/promote \
 *   -H "Authorization: Bearer <CRON_SECRET>" \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"h.khalid@datac.com"}'
 */
export async function POST(request: NextRequest) {
    // Verify CRON_SECRET authorization
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== process.env.CRON_SECRET) {
        return apiError(401, 'Unauthorized');
    }

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
}
