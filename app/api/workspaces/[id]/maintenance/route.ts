import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { MaintenanceService, MaintenanceCreateInput, MaintenanceUpdateInput } from '@/lib/services/MaintenanceService';
import { z } from 'zod';

const createSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    type: z.enum(['preventive', 'corrective', 'inspection']).default('preventive'),
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    assetId: z.string().min(1),
    notes: z.string().optional(),
    cost: z.number().min(0).optional(),
});

const updateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    type: z.enum(['preventive', 'corrective', 'inspection']).optional(),
    scheduledStart: z.string().datetime().optional(),
    scheduledEnd: z.string().datetime().optional(),
    actualStart: z.string().datetime().nullable().optional(),
    actualEnd: z.string().datetime().nullable().optional(),
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    notes: z.string().nullable().optional(),
    cost: z.number().min(0).nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const url = new URL(request.url);
    const windows = await MaintenanceService.listMaintenanceWindows(workspaceId, {
        assetId: url.searchParams.get('assetId'),
        status: url.searchParams.get('status'),
        upcoming: url.searchParams.get('upcoming') === 'true',
        limit: parseInt(url.searchParams.get('limit') || '50'),
    });
    return apiSuccess({ windows });
});

export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);
    const data = createSchema.parse(await request.json());
    const window = await MaintenanceService.createMaintenanceWindow(workspaceId, user.id, data as MaintenanceCreateInput);
    return apiSuccess({ window }, { message: 'Maintenance window created.' });
});

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);
    const url = new URL(request.url);
    const windowId = url.searchParams.get('windowId');
    if (!windowId) return apiError(400, 'windowId query parameter is required.');
    const data = updateSchema.parse(await request.json());
    const window = await MaintenanceService.updateMaintenanceWindow(workspaceId, user.id, windowId, data as MaintenanceUpdateInput);
    return apiSuccess({ window }, { message: 'Maintenance window updated.' });
});

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);
    const url = new URL(request.url);
    const windowId = url.searchParams.get('windowId');
    if (!windowId) return apiError(400, 'windowId query parameter is required.');
    const result = await MaintenanceService.deleteMaintenanceWindow(workspaceId, user.id, windowId);
    return apiSuccess(result, { message: 'Maintenance window deleted.' });
});
