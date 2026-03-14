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
            throw Object.assign(new Error('Remediation script not found or does not belong to this workspace'), { statusCode: 404 });
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
            throw Object.assign(new Error('Patch policy not found'), { statusCode: 404 });
        }

        if (!policy.isEnabled) {
            throw Object.assign(new Error('Cannot deploy a disabled patch policy. Please enable it first.'), { statusCode: 400 });
        }

        // Identify vulnerable endpoints logically across the workspace
        const vulnerableAgents = await prisma.agentConnection.findMany({
            where: {
                workspaceId,
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
            assetId: agent.assetId,
            createdBy: userId,
            status: ScriptStatus.PENDING
        }));

        // Perform an accelerated batch dispatch
        await prisma.scriptExecution.createMany({
            data: payload
        });

        return { executedCount: payload.length };
    }
}
