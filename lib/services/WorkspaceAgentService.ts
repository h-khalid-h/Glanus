import { ApiError } from '@/lib/errors';
/**
 * WorkspaceAgentService — Workspace-scoped RMM agent management and telemetry.
 *
 * Responsibilities:
 *  - listWorkspaceAgents: fetch all agents for a workspace with online/offline/error stats
 *  - getWorkspaceAgent: fetch a single agent with 24-hour metric history and recent executions
 *
 * Note: agent self-registration, heartbeat, and command handling live in AgentService.
 */
import { prisma } from '@/lib/db';

export class WorkspaceAgentService {
    /**
     * List agent connections for a workspace with online/offline/error statistics.
     * Supports pagination (default 100 per page). Stats reflect full workspace counts.
     */
    static async listWorkspaceAgents(workspaceId: string, page = 1, limit = 100) {
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const skip = (Math.max(page, 1) - 1) * safeLimit;

        const [agents, total, activeVersions, statusCounts] = await Promise.all([
            prisma.agentConnection.findMany({
                where: { workspaceId },
                include: { asset: { select: { id: true, name: true, model: true, serialNumber: true } } },
                orderBy: { lastSeen: 'desc' },
                skip,
                take: safeLimit,
            }),
            prisma.agentConnection.count({ where: { workspaceId } }),
            prisma.agentVersion.findMany({ where: { status: 'ACTIVE' }, take: 10 }),
            prisma.agentConnection.groupBy({
                by: ['status'],
                where: { workspaceId },
                _count: true,
            }),
        ]);

        const versionByPlatform = new Map(activeVersions.map((v) => [v.platform, v.version]));
        const _tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);

        const data = agents.map((agent) => ({
            id: agent.id,
            status: agent.status,
            platform: agent.platform,
            hostname: agent.hostname,
            agentVersion: agent.agentVersion,
            isOutdated: versionByPlatform.has(agent.platform)
                ? agent.agentVersion !== versionByPlatform.get(agent.platform)
                : false,
            ipAddress: agent.ipAddress || null,
            lastSeen: agent.lastSeen,
            cpuUsage: agent.cpuUsage || null,
            ramUsage: agent.ramUsage || null,
            diskUsage: agent.diskUsage || null,
            asset: agent.asset,
        }));

        const statusMap = new Map(statusCounts.map((s) => [s.status, s._count]));

        return {
            agents: data,
            stats: {
                total,
                online: statusMap.get('ONLINE') || 0,
                offline: statusMap.get('OFFLINE') || 0,
                error: statusMap.get('ERROR') || 0,
            },
            pagination: { page: Math.max(page, 1), limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
        };
    }

    /**
     * Fetch a single workspace agent with its 24-hour metric history and recent script executions.
     */
    static async getWorkspaceAgent(workspaceId: string, agentId: string) {
        const agent = await prisma.agentConnection.findUnique({
            where: { id: agentId, workspaceId },
            include: {
                asset: {
                    select: {
                        id: true, name: true, assetType: true, status: true,
                        serialNumber: true, manufacturer: true, model: true, location: true,
                    },
                },
                installedSoftware: { orderBy: { name: 'asc' } },
            },
        });
        if (!agent) throw new ApiError(404, 'Agent not found.');

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [metricHistory, recentExecutions] = await Promise.all([
            prisma.agentMetric.findMany({
                where: { agentId, timestamp: { gte: twentyFourHoursAgo } },
                select: { id: true, cpuUsage: true, ramUsage: true, diskUsage: true, timestamp: true },
                orderBy: { timestamp: 'asc' },
                take: 288,
            }),
            prisma.scriptExecution.findMany({
                where: { agentId, workspaceId },
                include: { script: { select: { id: true, name: true, language: true } } },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
        ]);

        return { agent, metricHistory, recentExecutions };
    }
}
