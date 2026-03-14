import { prisma } from '@/lib/db';

/**
 * NetworkService — Network topology and software inventory for a workspace.
 *
 * Responsibilities:
 *  - getNetworkTopology: devices + recent scans
 *  - getSoftwareInventory: aggregated installed software via raw SQL
 */
export class NetworkService {
    static async getNetworkTopology(workspaceId: string) {
        const [devices, scans] = await Promise.all([
            prisma.networkDevice.findMany({
                where: { workspaceId },
                orderBy: { lastSeen: 'desc' },
                include: { discoveredBy: { select: { hostname: true, platform: true } } },
            }),
            prisma.discoveryScan.findMany({
                where: { workspaceId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { agent: { select: { hostname: true } } },
            }),
        ]);

        return { devices, recentScans: scans };
    }

    /**
     * Aggregates installed software across all agents in the workspace via raw SQL.
     */
    static async getSoftwareInventory(workspaceId: string) {
        return prisma.$queryRaw`
            SELECT
                s.name,
                s.version,
                s.publisher,
                CAST(COUNT(DISTINCT s."agentId") AS INTEGER) as "installCount"
            FROM "InstalledSoftware" s
            JOIN "AgentConnection" a ON s."agentId" = a.id
            WHERE a."workspaceId" = ${workspaceId}
            GROUP BY s.name, s.version, s.publisher
            ORDER BY "installCount" DESC, s.name ASC
        `;
    }
}
