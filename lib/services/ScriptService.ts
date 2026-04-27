import { ApiError } from '@/lib/errors';
/**
 * ScriptService — Script library CRUD, execution history, and manual deploy.
 *
 * Responsibilities:
 *  - getScripts / getScriptById: fetch scripts with optional language filter
 *  - createScript / deleteScript: manage script records with audit logging
 *  - getScriptExecutions: paginated execution history with agent + script joins
 *  - deployScript: mass-dispatch a script to multiple ONLINE agents as PENDING executions
 *
 * Extracted to sibling service:
 *  - ScriptScheduleService → listSchedules / createSchedule / updateSchedule /
 *                            deleteSchedule / evaluateSchedules / getCronStatus
 */
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const createScriptSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().optional(),
    language: z.enum(['powershell', 'bash', 'python']),
    content: z.string().min(1, 'Script content cannot be empty'),
    tags: z.array(z.string()).optional().default([]),
    isPublic: z.boolean().optional().default(false),
});

export class ScriptService {
    /**
     * Fetch all scripts in the workspace.
     */
    static async getScripts(workspaceId: string, language?: string | null) {
        return prisma.script.findMany({
            where: {
                workspaceId,
                ...(language ? { language } : {})
            },
            orderBy: { updatedAt: 'desc' },
            include: {
                _count: {
                    select: { executions: true }
                }
            }
        });
    }

    /**
     * Create a new script in the library.
     */
    static async createScript(
        workspaceId: string,
        userId: string,
        data: z.infer<typeof createScriptSchema>
    ) {
        const script = await prisma.script.create({
            data: {
                workspaceId,
                name: data.name,
                description: data.description,
                language: data.language,
                content: data.content,
                tags: data.tags,
                isPublic: data.isPublic,
            }
        });

        // Create Audit Log
        await prisma.auditLog.create({
            data: {
                workspaceId,
                userId,
                action: 'script.created',
                resourceType: 'script',
                resourceId: script.id,
                details: { name: script.name, language: script.language }
            }
        });

        return script;
    }

    /**
     * Fetch a single script's details and payload content.
     */
    static async getScriptById(workspaceId: string, scriptId: string) {
        const script = await prisma.script.findUnique({
            where: {
                id: scriptId,
                workspaceId
            },
            include: {
                _count: {
                    select: { executions: true }
                }
            }
        });

        if (!script) {
            throw new ApiError(404, 'Script not found in this workspace.');
        }

        return script;
    }

    /**
     * Remove a script from the repository. Also nullifies execution history references.
     */
    static async deleteScript(workspaceId: string, scriptId: string, userId: string) {
        const script = await prisma.script.findUnique({
            where: { id: scriptId, workspaceId }
        });

        if (!script) {
            throw new ApiError(404, 'Script not found.');
        }

        await prisma.script.delete({
            where: { id: scriptId }
        });

        // Create Audit Log
        await prisma.auditLog.create({
            data: {
                workspaceId,
                userId,
                action: 'script.deleted',
                resourceType: 'script',
                resourceId: script.id,
                details: { name: script.name, language: script.language }
            }
        });

        return script;
    }

    /**
     * Fetch all script execution history for a workspace.
     */
    static async getScriptExecutions(
        workspaceId: string,
        options: {
            page?: number;
            limit?: number;
            status?: string | null;
            scriptId?: string | null;
            agentId?: string | null;
        } = {}
    ) {
        const limit = Math.min(200, Math.max(1, options.limit || 50));
        const page = Math.max(1, options.page || 1);
        const { status, scriptId, agentId } = options;

        const where: Record<string, unknown> = { workspaceId };
        if (status) where.status = status;
        if (scriptId) where.scriptId = scriptId;
        if (agentId) where.agentId = agentId;

        const [executions, total] = await Promise.all([
            prisma.scriptExecution.findMany({
                where,
                include: {
                    agent: {
                        select: {
                            id: true,
                            hostname: true,
                            platform: true,
                            status: true,
                        }
                    },
                    script: {
                        select: {
                            id: true,
                            name: true,
                            language: true,
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.scriptExecution.count({ where }),
        ]);

        return {
            executions,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // ========================================
    // SCRIPT DEPLOY (mass execution)
    // ========================================

    static async deployScript(workspaceId: string, scriptId: string, userId: string, targetAgentIds: string[]) {
        return prisma.$transaction(async (tx) => {
            const script = await tx.script.findUnique({ where: { id: scriptId, workspaceId } });
            if (!script) throw new ApiError(404, 'Script template not found.');

            const targetAgents = await tx.agentConnection.findMany({
                where: { id: { in: targetAgentIds }, workspaceId, status: 'ONLINE' },
                select: { id: true, assetId: true, hostname: true },
            });

            if (targetAgents.length === 0) {
                throw new ApiError(400, 'None of the provided agents are currently ONLINE or available in this workspace.');
            }

            const executionsData = targetAgents.map((agent) => ({
                workspaceId, agentId: agent.id, assetId: agent.assetId,
                scriptId: script.id, scriptName: script.name,
                scriptBody: script.content, language: script.language,
                status: 'PENDING' as const, createdBy: userId,
            }));

            await tx.scriptExecution.createMany({ data: executionsData });

            const spawnedExecutions = await tx.scriptExecution.findMany({
                where: { scriptId: script.id, agentId: { in: targetAgents.map((a) => a.id) }, status: 'PENDING' },
                orderBy: { createdAt: 'desc' },
                take: targetAgents.length,
            });

            await tx.auditLog.create({
                data: {
                    workspaceId, userId, action: 'script.deployed',
                    resourceType: 'script', resourceId: script.id,
                    details: { name: script.name, language: script.language, targetCount: targetAgents.length, targetAgents: targetAgents.map((a) => a.hostname) },
                },
            });

            return {
                deployedCount: targetAgents.length,
                skippedCount: targetAgentIds.length - targetAgents.length,
                executions: spawnedExecutions,
            };
        });
    }

    // ========================================
    // STALE EXECUTION REAPER
    // ========================================

    /**
     * Mark script executions stuck in PENDING/RUNNING for too long as TIMEOUT.
     *
     * Why this exists: the agent normally POSTs to /api/agent/command-result
     * when a script finishes. If the agent is restarted mid-flight, loses the
     * pending-results spool, or the command signature fails repeatedly, the
     * ScriptExecution row stays in RUNNING forever. This reaper closes that
     * window and keeps the UI honest.
     *
     * @param runningOlderThanMinutes - RUNNING rows older than this are TIMEOUT'd
     * @param pendingOlderThanMinutes - PENDING rows older than this are TIMEOUT'd
     *                                  (typically long because claim happens on heartbeat)
     */
    static async reapStaleExecutions(
        runningOlderThanMinutes = 15,
        pendingOlderThanMinutes = 30,
    ): Promise<{ runningReaped: number; pendingReaped: number }> {
        const now = Date.now();
        const runningCutoff = new Date(now - runningOlderThanMinutes * 60 * 1000);
        const pendingCutoff = new Date(now - pendingOlderThanMinutes * 60 * 1000);

        const [runningReaped, pendingReaped] = await Promise.all([
            prisma.scriptExecution.updateMany({
                where: {
                    status: 'RUNNING',
                    OR: [
                        { startedAt: { lt: runningCutoff } },
                        { startedAt: null, createdAt: { lt: runningCutoff } },
                    ],
                },
                data: {
                    status: 'TIMEOUT',
                    completedAt: new Date(),
                    error: `Agent did not report a result within ${runningOlderThanMinutes} minutes. The execution may have been interrupted, or the agent was restarted before completion.`,
                },
            }),
            prisma.scriptExecution.updateMany({
                where: {
                    status: 'PENDING',
                    createdAt: { lt: pendingCutoff },
                },
                data: {
                    status: 'TIMEOUT',
                    completedAt: new Date(),
                    error: `Command was never claimed by an agent within ${pendingOlderThanMinutes} minutes. The target agent may have been offline.`,
                },
            }),
        ]);

        return { runningReaped: runningReaped.count, pendingReaped: pendingReaped.count };
    }

    /**
     * Admin-initiated cancel of a single execution. Only terminates rows still
     * in PENDING or RUNNING. Returns null if the execution is already terminal
     * or doesn't belong to the workspace.
     */
    static async cancelExecution(
        workspaceId: string,
        executionId: string,
        userId: string,
    ): Promise<{ id: string; status: string } | null> {
        const execution = await prisma.scriptExecution.findFirst({
            where: { id: executionId, workspaceId },
            select: { id: true, status: true, scriptName: true },
        });
        if (!execution) return null;
        if (execution.status !== 'PENDING' && execution.status !== 'RUNNING') {
            return { id: execution.id, status: execution.status };
        }

        const updated = await prisma.scriptExecution.update({
            where: { id: executionId },
            data: {
                status: 'FAILED',
                completedAt: new Date(),
                error: 'Execution cancelled by operator.',
            },
            select: { id: true, status: true },
        });

        await prisma.auditLog.create({
            data: {
                workspaceId,
                userId,
                action: 'script_execution.cancelled',
                resourceType: 'script_execution',
                resourceId: executionId,
                details: { scriptName: execution.scriptName, previousStatus: execution.status },
            },
        });

        return updated;
    }
}
