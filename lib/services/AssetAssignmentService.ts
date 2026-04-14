import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/db';

/**
 * AssetAssignmentService — Production-grade asset ↔ user assignment lifecycle.
 *
 * Design constraints:
 *  - One active assignment per asset per workspace at any time (endDate = null).
 *  - All writes run inside a DB transaction to prevent race conditions.
 *  - Tenant isolation is enforced via workspaceId derived from the authenticated
 *    user's workspace membership — never from un-trusted request payload.
 *  - Overlapping date ranges for the same asset are rejected.
 */
export class AssetAssignmentService {
    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Resolve & verify that an asset belongs to a workspace the requesting user
     * is a member of. Returns the asset's workspaceId.
     */
    private static async resolveAssetWorkspace(
        assetId: string,
        requestingUserId: string,
    ): Promise<{ assetWorkspaceId: string }> {
        const asset = await prisma.asset.findFirst({
            where: {
                id: assetId,
                deletedAt: null,
                workspace: { members: { some: { userId: requestingUserId } } },
            },
            select: { workspaceId: true },
        });
        if (!asset) throw new ApiError(404, 'Asset not found');
        return { assetWorkspaceId: asset.workspaceId };
    }

    /**
     * Verify that the target user is a member of the given workspace.
     */
    private static async assertWorkspaceMember(
        userId: string,
        workspaceId: string,
    ): Promise<void> {
        const member = await prisma.workspaceMember.findFirst({
            where: { userId, workspaceId },
            select: { id: true },
        });
        if (!member) throw new ApiError(404, 'Target user is not a member of this workspace');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Assign an asset to a user.
     *
     * - If there is an existing active assignment, it is closed (endDate = now)
     *   and a new one is opened. This implements the "reassign" flow.
     * - startDate defaults to now() when omitted.
     * - Rejects a startDate that is in the past relative to an existing open
     *   assignment (would create an overlap).
     */
    static async assignAsset(
        assetId: string,
        requestingUserId: string,
        assigneeId: string,
        startDate?: Date | null,
        notes?: string | null,
    ) {
        const { assetWorkspaceId } = await this.resolveAssetWorkspace(assetId, requestingUserId);
        await this.assertWorkspaceMember(assigneeId, assetWorkspaceId);

        const effectiveStart = startDate ?? new Date();
        if (effectiveStart > new Date(Date.now() + 60_000 /* 1 min tolerance */)) {
            // Future start dates are fine — just validate the type.
        }

        return await prisma.$transaction(async (tx) => {
            // Fetch active assignment (endDate IS NULL)
            const activeAssignment = await tx.assetAssignment.findFirst({
                where: { assetId, workspaceId: assetWorkspaceId, endDate: null },
                select: { id: true, startDate: true, userId: true },
            });

            // Guard: reject overlapping ranges — new startDate cannot be before
            // an existing open assignment's startDate (that would be ambiguous).
            if (activeAssignment && effectiveStart < activeAssignment.startDate) {
                throw new ApiError(
                    409,
                    'Start date conflicts with an existing active assignment. Close the current assignment first.',
                );
            }

            // Close any active assignment (reassign flow)
            if (activeAssignment) {
                await tx.assetAssignment.update({
                    where: { id: activeAssignment.id },
                    data: { endDate: effectiveStart },
                });
            }

            // Create the new assignment record
            const assignment = await tx.assetAssignment.create({
                data: {
                    workspaceId: assetWorkspaceId,
                    assetId,
                    userId: assigneeId,
                    startDate: effectiveStart,
                    endDate: null,
                    assignedById: requestingUserId,
                    notes: notes ?? null,
                },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    assignedBy: { select: { id: true, name: true, email: true } },
                },
            });

            // Keep the Asset.assignedToId denormalized field in sync
            await tx.asset.update({
                where: { id: assetId },
                data: { assignedToId: assigneeId, status: 'ASSIGNED' },
            });

            // Also close any legacy AssignmentHistory record
            const legacyOpen = await tx.assignmentHistory.findFirst({
                where: { assetId, unassignedAt: null },
                select: { id: true },
            });
            if (legacyOpen) {
                await tx.assignmentHistory.update({
                    where: { id: legacyOpen.id },
                    data: { unassignedAt: effectiveStart },
                });
            }
            await tx.assignmentHistory.create({
                data: { assetId, userId: assigneeId, notes: notes ?? null },
            });

            await tx.auditLog.create({
                data: {
                    action: 'ASSET_ASSIGNED',
                    resourceType: 'Asset',
                    resourceId: assetId,
                    userId: requestingUserId,
                    assetId,
                    metadata: {
                        assignedTo: assignment.user.name,
                        assignedToId: assigneeId,
                        startDate: effectiveStart.toISOString(),
                        notes: notes ?? null,
                        previousAssignmentClosed: !!activeAssignment,
                    },
                },
            });

            return assignment;
        });
    }

    /**
     * Unassign an asset — closes the active assignment by setting endDate = now.
     * Throws 400 if the asset has no active assignment.
     */
    static async unassignAsset(assetId: string, requestingUserId: string) {
        const { assetWorkspaceId } = await this.resolveAssetWorkspace(assetId, requestingUserId);

        return await prisma.$transaction(async (tx) => {
            const activeAssignment = await tx.assetAssignment.findFirst({
                where: { assetId, workspaceId: assetWorkspaceId, endDate: null },
                include: { user: { select: { id: true, name: true, email: true } } },
            });

            if (!activeAssignment) {
                throw new ApiError(400, 'Asset does not have an active assignment');
            }

            const now = new Date();

            const closed = await tx.assetAssignment.update({
                where: { id: activeAssignment.id },
                data: { endDate: now },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    assignedBy: { select: { id: true, name: true, email: true } },
                },
            });

            // Sync denormalized field
            await tx.asset.update({
                where: { id: assetId },
                data: { assignedToId: null, status: 'AVAILABLE' },
            });

            // Close legacy AssignmentHistory record if still open
            const legacyOpen = await tx.assignmentHistory.findFirst({
                where: { assetId, unassignedAt: null },
                select: { id: true },
            });
            if (legacyOpen) {
                await tx.assignmentHistory.update({
                    where: { id: legacyOpen.id },
                    data: { unassignedAt: now },
                });
            }

            await tx.auditLog.create({
                data: {
                    action: 'ASSET_UNASSIGNED',
                    resourceType: 'Asset',
                    resourceId: assetId,
                    userId: requestingUserId,
                    assetId,
                    metadata: {
                        previouslyAssignedTo: activeAssignment.user.name,
                        previouslyAssignedToId: activeAssignment.userId,
                        endDate: now.toISOString(),
                    },
                },
            });

            return closed;
        });
    }

    /**
     * Return the full assignment history for an asset (newest first),
     * with user and assignedBy eager-loaded.
     */
    static async getAssetHistory(assetId: string, requestingUserId: string) {
        const { assetWorkspaceId } = await this.resolveAssetWorkspace(assetId, requestingUserId);

        const assignments = await prisma.assetAssignment.findMany({
            where: { assetId, workspaceId: assetWorkspaceId },
            orderBy: { startDate: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true } },
                assignedBy: { select: { id: true, name: true, email: true } },
            },
        });

        return assignments;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // LEGACY HELPERS (agent / script execution — unchanged)
    // ──────────────────────────────────────────────────────────────────────────

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

