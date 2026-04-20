import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * NetworkService — Network topology and software inventory for a workspace.
 *
 * Responsibilities:
 *  - getNetworkTopology: devices + recent scans
 *  - getSoftwareInventory: aggregated installed software via raw SQL
 */
export class NetworkService {
    static async getNetworkTopology(workspaceId: string, page = 1, limit = 20) {
        const [devices, totalDevices, scans] = await Promise.all([
            prisma.networkDevice.findMany({
                where: { workspaceId },
                orderBy: { lastSeen: 'desc' },
                include: { discoveredBy: { select: { hostname: true, platform: true } } },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.networkDevice.count({ where: { workspaceId } }),
            prisma.discoveryScan.findMany({
                where: { workspaceId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { agent: { select: { hostname: true } } },
            }),
        ]);

        return {
            devices,
            recentScans: scans,
            pagination: { page, limit, total: totalDevices, totalPages: Math.ceil(totalDevices / limit) },
        };
    }

    /**
     * Aggregates installed software across all agents in the workspace via raw SQL.
     */
    static async getSoftwareInventory(workspaceId: string, page = 1, limit = 20, search?: string) {
        const offset = (page - 1) * limit;
        const searchFilter = search
            ? Prisma.sql`AND (s.name ILIKE ${'%' + search + '%'} OR s.publisher ILIKE ${'%' + search + '%'} OR s.version ILIKE ${'%' + search + '%'})`
            : Prisma.empty;

        const [software, countResult] = await Promise.all([
            prisma.$queryRaw`
                SELECT
                    s.name,
                    s.version,
                    s.publisher,
                    CAST(COUNT(DISTINCT s."agentId") AS INTEGER) as "installCount"
                FROM "InstalledSoftware" s
                JOIN "AgentConnection" a ON s."agentId" = a.id
                WHERE a."workspaceId" = ${workspaceId} ${searchFilter}
                GROUP BY s.name, s.version, s.publisher
                ORDER BY "installCount" DESC, s.name ASC
                LIMIT ${limit} OFFSET ${offset}
            `,
            prisma.$queryRaw<[{ count: number }]>`
                SELECT CAST(COUNT(*) AS INTEGER) as count FROM (
                    SELECT s.name, s.version, s.publisher
                    FROM "InstalledSoftware" s
                    JOIN "AgentConnection" a ON s."agentId" = a.id
                    WHERE a."workspaceId" = ${workspaceId} ${searchFilter}
                    GROUP BY s.name, s.version, s.publisher
                ) sub
            `,
        ]);

        const total = countResult[0]?.count ?? 0;
        return { software, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }
}
