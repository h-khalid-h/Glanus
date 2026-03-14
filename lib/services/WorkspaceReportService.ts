/**
 * WorkspaceReportService — Generates and schedules workspace analytics reports.
 *
 * Responsibilities:
 *  - generateReport: produce an asset / compliance / security report for a workspace
 *  - listReportSchedules / createReportSchedule / updateReportSchedule / deleteReportSchedule: CRUD
 *  - processScheduledReports: cron-invoked — run all due report schedules
 */
import { prisma } from '@/lib/db';

export interface ReportScheduleCreateInput {
    name: string;
    reportType: 'asset_inventory' | 'rmm_health' | 'cortex_insights';
    format: 'csv';
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay: string;
    timezone: string;
    recipients: string[];
    enabled: boolean;
}

export interface ReportScheduleUpdateInput {
    name?: string;
    frequency?: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
    timezone?: string;
    recipients?: string[];
    enabled?: boolean;
}

/**
 * WorkspaceReportService — Generates on-demand CSV reports and manages report schedules.
 *
 * Responsibilities:
 *  - generateReport: generate 3 CSV types (asset_inventory, rmm_health, cortex_insights)
 *  - listReportSchedules / getReportSchedule: query schedules
 *  - createReportSchedule / updateReportSchedule / deleteReportSchedule: CRUD with audit trail
 */
export class WorkspaceReportService {
    static async generateReport(workspaceId: string, type: string): Promise<Response> {
        const filename = `glanus-${type}-${workspaceId}-${new Date().toISOString().split('T')[0]}.csv`;

        if (type === 'asset_inventory') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assets = await prisma.asset.findMany({
                where: { workspaceId },
                include: {
                    category: true, physicalAsset: true, digitalAsset: true,
                    agentConnection: {
                        select: {
                            status: true, updatedAt: true, platform: true,
                            metrics: { orderBy: { timestamp: 'desc' }, take: 1 },
                        },
                    },
                    aiInsights: { where: { type: 'failure_forecast' }, orderBy: { severity: 'desc' }, take: 1 },
                },
                orderBy: { createdAt: 'desc' },
            }) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

            const headers = 'Asset ID,Name,Category,Type,Status,Serial Number,Location,Agent Status,Last Seen,OS Platform,CPU Usage (%),RAM Usage (%),Disk Usage (%),Active ORACLE Forecast,Created At';
            const rows = assets.map((asset: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const agent = asset.agentConnection;
                const m = agent?.metrics?.[0];
                const forecast = asset.aiInsights[0];
                const categoryName = asset.category?.name || asset.physicalAsset?.category || asset.digitalAsset?.category || 'Uncategorized';
                const cpu = m?.cpuUsage !== undefined ? m.cpuUsage.toFixed(1) : 'N/A';
                const ram = m?.ramUsed !== undefined && m?.ramTotal ? ((m.ramUsed / m.ramTotal) * 100).toFixed(1) : 'N/A';
                const disk = m?.diskUsed !== undefined && m?.diskTotal ? ((m.diskUsed / m.diskTotal) * 100).toFixed(1) : 'N/A';
                return [
                    asset.id, `"${asset.name}"`, categoryName, asset.assetType, asset.status,
                    `"${asset.serialNumber || 'N/A'}"`, `"${asset.location || 'N/A'}"`,
                    agent?.status || 'UNMANAGED',
                    agent?.updatedAt ? agent.updatedAt.toISOString() : 'Never',
                    agent?.platform || 'Unknown', cpu, ram, disk,
                    `"${forecast ? `${forecast.severity} Risk: ${forecast.title}` : 'Normal'}"`,
                    asset.createdAt.toISOString(),
                ].join(',');
            });

            return new Response([headers, ...rows].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }

        if (type === 'rmm_health') {
            const agents = await prisma.agentConnection.findMany({
                where: { workspaceId },
                include: {
                    asset: { select: { name: true } },
                    scripts: { orderBy: { createdAt: 'desc' }, take: 5 },
                },
                orderBy: { lastSeen: 'desc' },
            }) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

            const headers = 'Agent ID,Linked Asset,Platform,Agent Version,Status,Last Seen,CPU (Latest),RAM (Latest),Recent Script Execution,Script Status';
            const rows = agents.map((agent: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const latestScript = agent.scripts[0];
                return [
                    agent.id, `"${agent.asset.name}"`, agent.platform, agent.agentVersion,
                    agent.status, agent.lastSeen.toISOString(),
                    agent.cpuUsage?.toFixed(1) || 'N/A', agent.ramUsage?.toFixed(1) || 'N/A',
                    `"${latestScript?.scriptName || 'None'}"`, latestScript?.status || 'N/A',
                ].join(',');
            });

            return new Response([headers, ...rows].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }

        if (type === 'cortex_insights') {
            const insights = await prisma.aIInsight.findMany({
                where: { workspaceId },
                include: { asset: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
            }) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

            const headers = 'Insight ID,Linked Asset,Type,Severity,Confidence,Title,Description,Status,Created At';
            const rows = insights.map((i: any) => [ // eslint-disable-line @typescript-eslint/no-explicit-any
                i.id, `"${i.asset?.name || 'Workspace Level'}"`, i.type,
                i.severity || 'INFO',
                i.confidence ? `${(i.confidence * 100).toFixed(0)}%` : 'N/A',
                `"${i.title}"`, `"${i.description}"`,
                i.acknowledged ? 'RESOLVED' : 'ACTIVE',
                i.createdAt.toISOString(),
            ].join(','));

            return new Response([headers, ...rows].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }

        throw Object.assign(new Error(`Unknown report type: ${type}`), { statusCode: 400 });
    }

    static async listReportSchedules(workspaceId: string) {
        return prisma.reportSchedule.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
        });
    }

    static async getReportSchedule(workspaceId: string, scheduleId: string) {
        const schedule = await prisma.reportSchedule.findUnique({
            where: { id: scheduleId, workspaceId },
        });
        if (!schedule) throw Object.assign(new Error('Schedule not found.'), { statusCode: 404 });
        return schedule;
    }

    static async createReportSchedule(workspaceId: string, userId: string, data: ReportScheduleCreateInput) {
        const dayOfWeek = data.frequency === 'weekly' && data.dayOfWeek === undefined ? 1 : data.dayOfWeek;
        const dayOfMonth = data.frequency === 'monthly' && data.dayOfMonth === undefined ? 1 : data.dayOfMonth;

        const schedule = await prisma.reportSchedule.create({
            data: {
                workspaceId, name: data.name, reportType: data.reportType, format: data.format,
                frequency: data.frequency, dayOfWeek, dayOfMonth, timeOfDay: data.timeOfDay,
                timezone: data.timezone, recipients: data.recipients, enabled: data.enabled,
                createdBy: userId,
            },
        });

        await prisma.auditLog.create({
            data: {
                workspaceId, userId, action: 'report_schedule.created',
                resourceType: 'report_schedule', resourceId: schedule.id,
                details: { name: schedule.name, reportType: schedule.reportType, frequency: schedule.frequency, recipientCount: schedule.recipients.length },
            },
        });

        return schedule;
    }

    static async updateReportSchedule(workspaceId: string, userId: string, scheduleId: string, data: ReportScheduleUpdateInput) {
        const existing = await prisma.reportSchedule.findUnique({ where: { id: scheduleId, workspaceId } });
        if (!existing) throw Object.assign(new Error('Schedule not found.'), { statusCode: 404 });

        const updated = await prisma.reportSchedule.update({
            where: { id: scheduleId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.frequency && { frequency: data.frequency }),
                ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
                ...(data.dayOfMonth !== undefined && { dayOfMonth: data.dayOfMonth }),
                ...(data.timeOfDay && { timeOfDay: data.timeOfDay }),
                ...(data.timezone && { timezone: data.timezone }),
                ...(data.recipients && { recipients: data.recipients }),
                ...(data.enabled !== undefined && { enabled: data.enabled }),
            },
        });

        await prisma.auditLog.create({
            data: {
                workspaceId, userId, action: 'report_schedule.updated',
                resourceType: 'report_schedule', resourceId: updated.id,
                details: { changes: Object.keys(data) },
            },
        });

        return updated;
    }

    static async deleteReportSchedule(workspaceId: string, userId: string, scheduleId: string) {
        const existing = await prisma.reportSchedule.findUnique({ where: { id: scheduleId, workspaceId } });
        if (!existing) throw Object.assign(new Error('Schedule not found.'), { statusCode: 404 });

        await prisma.reportSchedule.delete({ where: { id: scheduleId } });

        await prisma.auditLog.create({
            data: {
                workspaceId, userId, action: 'report_schedule.deleted',
                resourceType: 'report_schedule', resourceId: existing.id,
                details: { name: existing.name },
            },
        });

        return null;
    }
}
