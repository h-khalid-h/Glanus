import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { ScriptScheduleService } from '@/lib/services/ScriptScheduleService';
import { z } from 'zod';

const createScheduleSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    scriptId: z.string().min(1, 'Script ID is required'),
    targetIds: z.array(z.string()).min(1, 'At least one target agent must be selected'),
    cronExpression: z.string().min(1, 'Cron expression is required'),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET - List all script schedules for a workspace
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const schedules = await ScriptScheduleService.listSchedules(workspaceId);
    return apiSuccess({ schedules });
});

// POST - Create a new script schedule
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const data = createScheduleSchema.parse(await request.json());
    const schedule = await ScriptScheduleService.createSchedule(workspaceId, data);
    return apiSuccess({ schedule }, undefined, 201);
});
