import { ApiError } from '@/lib/errors';
/**
 * PatchService — Automated patch policy management and execution dispatch.
 *
 * Responsibilities:
 *  - getPatchPolicies: list patch policies with vulnerable endpoint counts
 *  - createPatchPolicy: create a new patch policy with remediation script validation
 *  - updatePatchPolicy: update policy name/target/script/enabled flag
 *  - deletePatchPolicy: remove a policy by ID
 *  - executePatchPolicy: dispatch script executions to all vulnerable endpoints
 */
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { ScriptStatus } from '@prisma/client';

export const createPatchPolicySchema = z.object({
    name: z.string().min(1).max(255),
    targetSoftware: z.string().min(1).max(255),
    actionScriptId: z.string(),
    isEnabled: z.boolean().default(true),
});

export class PatchService {
    /**
     * Fetch all Patch Policies for a workspace, enriched with the number of vulnerable endpoints.
     */
    static async getPatchPolicies(workspaceId: string) {
        const policies = await prisma.patchPolicy.findMany({
            where: { workspaceId },
            include: {
                actionScript: { select: { id: true, name: true, language: true } },
            },
            orderBy: { createdAt: 'desc' }
        });

        // Compute vulnerability counts
        return Promise.all(policies.map(async (policy) => {
            const vulnerableCount = await prisma.agentConnection.count({
                where: {
                    workspaceId,
                    installedSoftware: {
                        some: { name: { contains: policy.targetSoftware, mode: 'insensitive' } }
                    }
                }
            });
            return { ...policy, vulnerableCount };
        }));
    }

    /**
     * Create a new automated Patch Policy.
     */
    static async createPatchPolicy(
        workspaceId: string,
        data: z.infer<typeof createPatchPolicySchema>
    ) {
        const script = await prisma.script.findUnique({
            where: { id: data.actionScriptId, workspaceId }
        });

        if (!script) {
            throw new ApiError(404, 'Remediation script not found or does not belong to this workspace');
        }

        return prisma.patchPolicy.create({
            data: {
                workspaceId,
                name: data.name,
                targetSoftware: data.targetSoftware,
                actionScriptId: data.actionScriptId,
                isEnabled: data.isEnabled,
            },
            include: {
                actionScript: { select: { id: true, name: true, language: true } },
            }
        });
    }

    /**
     * Execute a specific Patch Policy across all vulnerable endpoints in the workspace.
     */
    static async executePatchPolicy(workspaceId: string, patchId: string, userId: string) {
        const policy = await prisma.patchPolicy.findUnique({
            where: { id: patchId, workspaceId },
            include: { actionScript: true }
        });

        if (!policy) {
            throw new ApiError(404, 'Patch policy not found');
        }

        if (!policy.isEnabled) {
            throw new ApiError(400, 'Cannot deploy a disabled patch policy. Please enable it first.');
        }

        if (!policy.actionScript) {
            throw new ApiError(400, 'Patch policy has no associated script. Please assign a script before deploying.');
        }

        // Identify vulnerable endpoints logically across the workspace
        const vulnerableAgents = await prisma.agentConnection.findMany({
            where: {
                workspaceId,
                assetId: { not: null },
                installedSoftware: {
                    some: {
                        name: { contains: policy.targetSoftware, mode: 'insensitive' }
                    }
                }
            },
            select: { id: true, assetId: true }
        });

        if (vulnerableAgents.length === 0) {
            return { executedCount: 0 };
        }

        const payload = vulnerableAgents.map(agent => ({
            scriptId: policy.actionScriptId,
            scriptName: policy.actionScript.name,
            language: policy.actionScript.language,
            scriptBody: policy.actionScript.content,
            workspaceId,
            agentId: agent.id,
            assetId: agent.assetId as string,
            createdBy: userId,
            status: ScriptStatus.PENDING
        }));

        // Perform an accelerated batch dispatch
        await prisma.scriptExecution.createMany({
            data: payload
        });

        return { executedCount: payload.length };
    }
    /**
     * Update an existing patch policy.
     */
    static async updatePatchPolicy(workspaceId: string, patchId: string, data: PatchPolicyUpdateInput) {
        const policy = await prisma.patchPolicy.findUnique({ where: { id: patchId, workspaceId } });
        if (!policy) throw new ApiError(404, 'Patch policy not found');

        if (data.actionScriptId) {
            const script = await prisma.script.findUnique({ where: { id: data.actionScriptId, workspaceId } });
            if (!script) throw new ApiError(404, 'Replacement remediation script not found');
        }

        return prisma.patchPolicy.update({
            where: { id: patchId },
            data,
            include: { actionScript: { select: { id: true, name: true, language: true } } },
        });
    }

    /**
     * Delete a patch policy.
     */
    static async deletePatchPolicy(workspaceId: string, patchId: string) {
        const policy = await prisma.patchPolicy.findUnique({ where: { id: patchId, workspaceId } });
        if (!policy) throw new ApiError(404, 'Patch policy not found');
        await prisma.patchPolicy.delete({ where: { id: patchId } });
        return { deleted: true };
    }
}

export interface PatchPolicyUpdateInput {
    name?: string;
    targetSoftware?: string;
    actionScriptId?: string;
    isEnabled?: boolean;
}
