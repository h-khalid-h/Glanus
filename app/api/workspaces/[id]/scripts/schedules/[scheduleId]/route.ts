import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { ScriptScheduleService } from '@/lib/services/ScriptScheduleService';
import { z } from 'zod';

const updateScheduleSchema = z.object({
    name: z.string().min(1, 'Name is required').optional(),
    description: z.string().optional(),
    targetIds: z.array(z.string()).min(1, 'At least one target agent must be selected').optional(),
    cronExpression: z.string().min(1, 'Cron expression is required').optional(),
    enabled: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string; scheduleId: string }> };

// PATCH - Update a script schedule
export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id: workspaceId, scheduleId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const data = updateScheduleSchema.parse(await request.json());
    const schedule = await ScriptScheduleService.updateSchedule(workspaceId, scheduleId, data);
    return apiSuccess({ schedule });
});

// DELETE - Delete a script schedule
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id: workspaceId, scheduleId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const result = await ScriptScheduleService.deleteSchedule(workspaceId, scheduleId);
    return apiSuccess(result);
});
