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
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { logInfo, logError } from '@/lib/logger';
import { CronExpressionParser } from 'cron-parser';

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
            limit?: number;
            status?: string | null;
            scriptId?: string | null;
            agentId?: string | null;
        } = {}
    ) {
        const limit = Math.min(200, Math.max(1, options.limit || 50));
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
                take: limit,
            }),
            prisma.scriptExecution.count({ where }),
        ]);

        return {
            executions,
            total,
            limit,
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
}
