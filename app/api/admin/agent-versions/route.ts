import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAdmin, runWithUserRLS, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
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
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAdmin();
    return runWithUserRLS(user, async () => {
        const versions = await AdminService.listAgentVersions();
        return apiSuccess({ versions });
    });
});

// POST /api/admin/agent-versions
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAdmin();
    const data = agentVersionSchema.parse(await request.json());
    return runWithUserRLS(user, async () => {
        const version = await AdminService.publishAgentVersion(data);
        return apiSuccess({ version }, undefined, 201);
    });
});
