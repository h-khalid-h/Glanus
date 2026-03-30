import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { apiSuccess } from '@/lib/api/response';
import { WorkspaceReportService, ReportScheduleCreateInput } from '@/lib/services/WorkspaceReportService';
import { z } from 'zod';

const createScheduleSchema = z.object({
    name: z.string().min(1, 'Schedule name is required').max(100),
    reportType: z.enum(['asset_inventory', 'rmm_health', 'cortex_insights']),
    format: z.enum(['csv']).default('csv'),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').default('08:00'),
    timezone: z.string().default('UTC'),
    recipients: z.array(z.string().email('Each recipient must be a valid email')).min(1, 'At least one recipient email is required'),
    enabled: z.boolean().default(true),
});

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER');
    const schedules = await WorkspaceReportService.listReportSchedules(workspaceId);
    return apiSuccess({ schedules });
});

export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');
    const data = createScheduleSchema.parse(await request.json());
    const schedule = await WorkspaceReportService.createReportSchedule(workspaceId, user.id, data as ReportScheduleCreateInput);
    return apiSuccess({ schedule }, { message: 'Report schedule created successfully' }, 201);
});
