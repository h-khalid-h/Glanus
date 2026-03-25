import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { prisma } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/workspaces/[id]/network/sweep - Trigger subnet sweep on all online agents
export const POST = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER');

    // Find all online agents in this workspace
    const agents = await prisma.agentConnection.findMany({
        where: {
            workspaceId,
            status: 'ONLINE',
        },
        select: {
            id: true,
            hostname: true,
            ipAddress: true,
        },
    });

    if (agents.length === 0) {
        return apiError(404, 'No online agents available to run discovery scan');
    }

    // Create a PENDING discovery scan for each agent
    // Agents derive the subnet from their own IP when subnet is "auto"
    const scans = await Promise.all(
        agents.map((agent) =>
            prisma.discoveryScan.create({
                data: {
                    workspaceId,
                    agentId: agent.id,
                    subnet: agent.ipAddress ? `${agent.ipAddress.split('.').slice(0, 3).join('.')}.0/24` : 'auto',
                    status: 'PENDING',
                    devicesFound: 0,
                },
            })
        )
    );

    return apiSuccess({
        scansCreated: scans.length,
        agents: agents.map((a) => a.hostname || a.id),
    });
});
