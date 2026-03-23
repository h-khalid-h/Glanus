import { ApiError } from '@/lib/errors';
/**
 * MaintenanceService — Manages scheduled maintenance windows for workspace assets.
 *
 * Responsibilities:
 *  - listMaintenanceWindows: query windows with optional asset/date filters
 *  - createMaintenanceWindow: schedule a new maintenance window
 *  - updateMaintenanceWindow: modify an existing window
 *  - deleteMaintenanceWindow: remove a window by ID
 */
import { prisma } from '@/lib/db';

export interface MaintenanceCreateInput {
    title: string;
    description?: string;
    type: 'preventive' | 'corrective' | 'inspection';
    scheduledStart: string;
    scheduledEnd: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    assetId: string;
    notes?: string;
    cost?: number;
}

export interface MaintenanceUpdateInput {
    title?: string;
    description?: string | null;
    type?: 'preventive' | 'corrective' | 'inspection';
    scheduledStart?: string;
    scheduledEnd?: string;
    actualStart?: string | null;
    actualEnd?: string | null;
    status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    notes?: string | null;
    cost?: number | null;
}

export interface MaintenanceQueryInput {
    assetId?: string | null;
    status?: string | null;
    upcoming?: boolean;
    limit?: number;
}

/**
 * MaintenanceService — Manages maintenance windows for workspace assets.
 *
 * Responsibilities:
 *  - listMaintenanceWindows: filtered query with asset includes
 *  - createMaintenanceWindow: validation + creation + audit
 *  - updateMaintenanceWindow: partial update with ownership check
 *  - deleteMaintenanceWindow: delete with audit trail
 */
export class MaintenanceService {
    static async listMaintenanceWindows(workspaceId: string, filters: MaintenanceQueryInput) {
        const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
        return prisma.maintenanceWindow.findMany({
            where: {
                workspaceId,
                ...(filters.assetId && { assetId: filters.assetId }),
                ...(filters.status && { status: filters.status }),
                ...(filters.upcoming && { scheduledStart: { gte: new Date() }, status: 'scheduled' }),
            },
            include: { asset: { select: { id: true, name: true, status: true } } },
            orderBy: { scheduledStart: 'asc' },
            take: limit,
        });
    }

    static async createMaintenanceWindow(workspaceId: string, userId: string, data: MaintenanceCreateInput) {
        const asset = await prisma.asset.findFirst({ where: { id: data.assetId, workspaceId } });
        if (!asset) throw new ApiError(400, 'Asset not found in this workspace.');

        if (new Date(data.scheduledEnd) <= new Date(data.scheduledStart)) {
            throw new ApiError(400, 'Scheduled end must be after scheduled start.');
        }

        const window = await prisma.maintenanceWindow.create({
            data: {
                title: data.title, description: data.description, type: data.type,
                scheduledStart: new Date(data.scheduledStart), scheduledEnd: new Date(data.scheduledEnd),
                priority: data.priority, notes: data.notes, cost: data.cost,
                assetId: data.assetId, workspaceId, createdById: userId,
            },
            include: { asset: { select: { id: true, name: true } } },
        });

        await prisma.auditLog.create({
            data: {
                workspaceId, userId, action: 'maintenance.created',
                resourceType: 'maintenanceWindow', resourceId: window.id,
                details: { title: data.title, assetId: data.assetId, priority: data.priority },
            },
        });

        return window;
    }

    static async updateMaintenanceWindow(workspaceId: string, userId: string, windowId: string, data: MaintenanceUpdateInput) {
        const existing = await prisma.maintenanceWindow.findFirst({ where: { id: windowId, workspaceId } });
        if (!existing) throw new ApiError(404, 'Maintenance window not found.');

        void userId; // captured for future audit

        const effectiveStart = data.scheduledStart !== undefined ? new Date(data.scheduledStart) : existing.scheduledStart;
        const effectiveEnd = data.scheduledEnd !== undefined ? new Date(data.scheduledEnd) : existing.scheduledEnd;
        if (effectiveEnd <= effectiveStart) {
            throw new ApiError(400, 'Scheduled end must be after scheduled start.');
        }

        return prisma.maintenanceWindow.update({
            where: { id: windowId },
            data: {
                ...(data.title !== undefined && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.type !== undefined && { type: data.type }),
                ...(data.scheduledStart !== undefined && { scheduledStart: new Date(data.scheduledStart) }),
                ...(data.scheduledEnd !== undefined && { scheduledEnd: new Date(data.scheduledEnd) }),
                ...(data.actualStart !== undefined && { actualStart: data.actualStart ? new Date(data.actualStart) : null }),
                ...(data.actualEnd !== undefined && { actualEnd: data.actualEnd ? new Date(data.actualEnd) : null }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.priority !== undefined && { priority: data.priority }),
                ...(data.notes !== undefined && { notes: data.notes }),
                ...(data.cost !== undefined && { cost: data.cost }),
            },
            include: { asset: { select: { id: true, name: true } } },
        });
    }

    static async deleteMaintenanceWindow(workspaceId: string, userId: string, windowId: string) {
        const existing = await prisma.maintenanceWindow.findFirst({ where: { id: windowId, workspaceId } });
        if (!existing) throw new ApiError(404, 'Maintenance window not found.');

        await prisma.maintenanceWindow.delete({ where: { id: windowId } });

        await prisma.auditLog.create({
            data: {
                workspaceId, userId, action: 'maintenance.deleted',
                resourceType: 'maintenanceWindow', resourceId: windowId,
                details: { title: existing.title },
            },
        });

        return { deleted: true };
    }
}
