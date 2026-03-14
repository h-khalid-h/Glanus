import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { AdminService } from '@/lib/services/AdminService';

const agentVersionSchema = z.object({
    version: z.string().min(1),
    platform: z.enum(['WINDOWS', 'MACOS', 'LINUX']),
    downloadUrl: z.string().url(),
    checksum: z.string().min(64).max(64),
    status: z.enum(['ACTIVE', 'DEPRECATED', 'BETA']),
    required: z.boolean().default(false),
    releaseNotes: z.string().optional(),
});

// GET /api/admin/agent-versions
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') return apiError(403, 'Forbidden. Requires Platform Administrator privileges.');
    const versions = await AdminService.listAgentVersions();
    return apiSuccess({ versions });
});

// POST /api/admin/agent-versions
export const POST = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') return apiError(403, 'Forbidden. Requires Platform Administrator privileges.');
    const body = await request.json();
    const data = agentVersionSchema.parse(body);
    try {
        const version = await AdminService.publishAgentVersion(data);
        return apiSuccess({ version }, undefined, 201);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Failed to publish agent version');
    }
});
