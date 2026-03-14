import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { WorkspaceReportService, ReportScheduleUpdateInput } from '@/lib/services/WorkspaceReportService';
import { z } from 'zod';

const updateScheduleSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    timezone: z.string().optional(),
    recipients: z.array(z.string().email()).min(1).optional(),
    enabled: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string; scheduleId: string }> };

export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, scheduleId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER');
    const schedule = await WorkspaceReportService.getReportSchedule(workspaceId, scheduleId);
    return apiSuccess({ schedule });
});

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, scheduleId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const data = updateScheduleSchema.parse(await request.json());
    const schedule = await WorkspaceReportService.updateReportSchedule(workspaceId, user.id, scheduleId, data as ReportScheduleUpdateInput);
    return apiSuccess({ schedule });
});

export const DELETE = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, scheduleId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    await WorkspaceReportService.deleteReportSchedule(workspaceId, user.id, scheduleId);
    return apiSuccess(null, { message: 'Schedule deleted successfully' });
});
