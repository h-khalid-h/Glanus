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
     * List all agent connections for a workspace with online/offline/error statistics.
     */
    static async listWorkspaceAgents(workspaceId: string) {
        const [agents, activeVersions] = await Promise.all([
            prisma.agentConnection.findMany({
                where: { workspaceId },
                include: { asset: { select: { id: true, name: true, model: true, serialNumber: true } } },
                orderBy: { lastSeen: 'desc' },
            }),
            prisma.agentVersion.findMany({ where: { status: 'ACTIVE' }, take: 10 }),
        ]);

        const versionByPlatform = new Map(activeVersions.map((v) => [v.platform, v.version]));
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);

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

        const errorAgents = agents.filter((a) => a.status === 'ERROR');
        const onlineAgents = agents.filter((a) => a.status === 'ONLINE' && a.lastSeen > tenMinsAgo);
        const offlineAgents = agents.filter((a) => a.status !== 'ERROR' && (a.status === 'OFFLINE' || (a.status === 'ONLINE' && a.lastSeen <= tenMinsAgo)));

        return {
            agents: data,
            stats: {
                total: agents.length,
                online: onlineAgents.length,
                offline: offlineAgents.length,
                error: errorAgents.length,
            },
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
