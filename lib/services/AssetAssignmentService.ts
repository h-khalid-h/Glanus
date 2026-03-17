import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/db';

/**
 * AssetAssignmentService — Manages asset assignment lifecycle and script execution.
 *
 * Responsibilities:
 *  - assignAsset: assign to a user, close prior assignment, audit
 *  - unassignAsset: clear assignment, close history record, audit
 *  - executeScript: queue a script for execution on the linked agent
 *  - getScriptHistory: fetch recent script execution records
 *  - getLinkedAgent: retrieve the agent connected to an asset
 */
export class AssetAssignmentService {
    static async assignAsset(assetId: string, requestingUserId: string, assigneeId: string, notes?: string | null) {
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, deletedAt: null, workspace: { members: { some: { userId: requestingUserId } } } },
        });
        if (!asset) throw new ApiError(404, 'Asset not found');

        const targetUser = await prisma.user.findUnique({ where: { id: assigneeId } });
        if (!targetUser) throw new ApiError(404, 'User not found');

        // Close previous open assignment
        if (asset.assignedToId) {
            const currentAssignment = await prisma.assignmentHistory.findFirst({ where: { assetId, unassignedAt: null } });
            if (currentAssignment) {
                await prisma.assignmentHistory.update({ where: { id: currentAssignment.id }, data: { unassignedAt: new Date() } });
            }
        }

        await prisma.assignmentHistory.create({ data: { assetId, userId: assigneeId, notes: notes || null } });

        const updatedAsset = await prisma.asset.update({
            where: { id: assetId },
            data: { assignedToId: assigneeId, status: 'ASSIGNED' },
            include: { assignedTo: { select: { id: true, name: true, email: true } } },
        });

        await prisma.auditLog.create({
            data: {
                action: 'ASSET_ASSIGNED', resourceType: 'Asset', resourceId: assetId,
                userId: requestingUserId, assetId,
                metadata: { assetName: updatedAsset.name, assignedTo: targetUser.name, assignedToId: assigneeId, notes },
            },
        });

        return updatedAsset;
    }

    static async unassignAsset(assetId: string, requestingUserId: string) {
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, deletedAt: null, workspace: { members: { some: { userId: requestingUserId } } } },
            include: { assignedTo: true },
        });
        if (!asset) throw new ApiError(404, 'Asset not found');
        if (!asset.assignedToId) throw new ApiError(400, 'Asset is not currently assigned');

        const currentAssignment = await prisma.assignmentHistory.findFirst({ where: { assetId, unassignedAt: null } });
        if (currentAssignment) {
            await prisma.assignmentHistory.update({ where: { id: currentAssignment.id }, data: { unassignedAt: new Date() } });
        }

        const updatedAsset = await prisma.asset.update({ where: { id: assetId }, data: { assignedToId: null, status: 'AVAILABLE' } });

        await prisma.auditLog.create({
            data: {
                action: 'ASSET_UNASSIGNED', resourceType: 'Asset', resourceId: assetId,
                userId: requestingUserId, assetId,
                metadata: { assetName: updatedAsset.name, previouslyAssignedTo: asset.assignedTo?.name },
            },
        });

        return updatedAsset;
    }

    static async executeScript(assetId: string, userId: string, data: { scriptName: string; scriptBody: string; language: string }) {
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, workspace: { members: { some: { userId } } } },
            include: { agentConnection: true, workspace: true },
        });
        if (!asset) throw new ApiError(404, 'Asset not found or access denied');
        if (!asset.agentConnection) throw new ApiError(400, 'No agent installed on this asset');

        if (asset.agentConnection.status === 'OFFLINE') {
            return { queued: true, message: 'Agent is offline. Script will be queued and executed when agent comes online.' };
        }

        const execution = await prisma.scriptExecution.create({
            data: {
                agentId: asset.agentConnection.id, assetId, workspaceId: asset.workspaceId!,
                scriptName: data.scriptName, scriptBody: data.scriptBody, language: data.language,
                status: 'PENDING', createdBy: userId,
            },
        });

        return { executionId: execution.id, status: 'pending', message: 'Script queued for execution' };
    }

    static async getScriptHistory(assetId: string, userId: string) {
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, workspace: { members: { some: { userId } } } },
        });
        if (!asset) throw new ApiError(404, 'Asset not found or access denied');

        const executions = await prisma.scriptExecution.findMany({
            where: { assetId }, orderBy: { createdAt: 'desc' }, take: 50,
        });

        return { executions };
    }

    static async getLinkedAgent(assetId: string, userId: string) {
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, workspace: { members: { some: { userId } } } },
            include: { agentConnection: true },
        });
        if (!asset) throw new ApiError(404, 'Asset not found or access denied');
        if (!asset.agentConnection) throw new ApiError(404, 'No agent connected to this asset');
        return asset.agentConnection;
    }
}
