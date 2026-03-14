/**
 * ScriptService — Manages automation scripts and their scheduled execution.
 *
 * Responsibilities:
 *  - getScripts / getScriptById: fetch scripts with optional language filter
 *  - createScript / updateScript / deleteScript: CRUD for script records
 *  - updateSchedule: modify cron schedule and re-compute nextRunAt
 *  - processDueSchedules: cron-invoked — generate pending executions for eligible targets
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
            throw Object.assign(new Error('Script not found in this workspace.'), { statusCode: 404 });
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
            throw Object.assign(new Error('Script not found.'), { statusCode: 404 });
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

    /**
     * Finds and processes any due script schedules, generating executions for targets.
     * Extracts complex DB schedule parsing from the cron HTTP route.
     */
    static async evaluateSchedules() {
        logInfo('[SERVICE] Starting script execution scheduler...');
        const startTime = Date.now();
        const now = new Date();

        // 1. Find all active schedules that are due
        const dueSchedules = await prisma.scriptSchedule.findMany({
            where: {
                enabled: true,
                nextRunAt: {
                    lte: now,
                },
            },
            include: {
                script: true,
            },
        });

        let executionsQueued = 0;
        let schedulesProcessed = 0;
        let errors = 0;

        // 2. Process each due schedule
        for (const schedule of dueSchedules) {
            try {
                const targetIds = schedule.targetIds as string[];

                if (targetIds && targetIds.length > 0) {
                    const agents = await prisma.agentConnection.findMany({
                        where: { id: { in: targetIds } },
                        select: { id: true, assetId: true }
                    });

                    // Create pending script executions for each target agent
                    const executionPromises = agents.map((agent) =>
                        prisma.scriptExecution.create({
                            data: {
                                scriptId: schedule.scriptId,
                                scriptName: schedule.script.name,
                                scriptBody: schedule.script.content,
                                language: schedule.script.language,
                                agentId: agent.id,
                                assetId: agent.assetId,
                                workspaceId: schedule.workspaceId,
                                status: 'PENDING',
                                createdBy: 'system_cron'
                            }
                        })
                    );

                    await Promise.all(executionPromises);
                    executionsQueued += agents.length;

                    // Log the dispatch
                    logInfo(`[SERVICE] Dispatched schedule ${schedule.id} (${schedule.name}) to ${targetIds.length} agents.`);
                }

                // 3. Calculate and update next run time
                let nextRunAt: Date | null = null;
                try {
                    const interval = CronExpressionParser.parse(schedule.cronExpression, { currentDate: now });
                    nextRunAt = interval.next().toDate();
                } catch (err) {
                    logError(`[SERVICE] Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`, err);
                }

                await prisma.scriptSchedule.update({
                    where: { id: schedule.id },
                    data: {
                        lastRunAt: now,
                        nextRunAt: nextRunAt,
                        runCount: { increment: 1 }
                    }
                });

                schedulesProcessed++;
            } catch (err) {
                logError(`[SERVICE] Failed to process schedule ${schedule.id}`, err);
                errors++;
            }
        }

        const duration = Date.now() - startTime;

        const stats = {
            schedulesProcessed,
            executionsQueued,
            errors,
            durationMs: duration
        };

        logInfo('[SERVICE] Script scheduler complete', stats);
        return stats;
    }

    /**
     * Returns a status snapshot of the script cron system.
     */
    static async getCronStatus() {
        const stats = await prisma.scriptSchedule.aggregate({
            _count: { id: true },
            where: { enabled: true },
        });

        return {
            status: 'ready' as const,
            activeSchedules: stats._count.id,
            cronInfo: {
                endpoint: '/api/cron/scripts',
                method: 'POST',
                recommendedInterval: '* * * * *',
                requiresAuth: !!process.env.CRON_SECRET,
            },
        };
    }

    // ========================================
    // SCRIPT SCHEDULES
    // ========================================

    static async listSchedules(workspaceId: string) {
        return prisma.scriptSchedule.findMany({
            where: { workspaceId },
            include: { script: { select: { id: true, name: true, language: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    static async createSchedule(
        workspaceId: string,
        data: { name: string; description?: string; scriptId: string; targetIds: string[]; cronExpression: string }
    ) {
        // Validate script exists in workspace
        const script = await prisma.script.findFirst({ where: { id: data.scriptId, workspaceId } });
        if (!script) throw Object.assign(new Error('Script not found'), { statusCode: 404 });

        // Validate and parse next run time
        let nextRunAt: Date;
        try {
            const interval = CronExpressionParser.parse(data.cronExpression);
            nextRunAt = interval.next().toDate();
        } catch {
            throw Object.assign(new Error('Invalid cron expression'), { statusCode: 400 });
        }

        return prisma.scriptSchedule.create({
            data: {
                workspaceId, scriptId: data.scriptId, name: data.name,
                description: data.description, targetIds: data.targetIds,
                cronExpression: data.cronExpression, nextRunAt, enabled: true,
            },
            include: { script: { select: { id: true, name: true, language: true } } },
        });
    }

    static async updateSchedule(
        workspaceId: string,
        scheduleId: string,
        data: { name?: string; description?: string; targetIds?: string[]; cronExpression?: string; enabled?: boolean }
    ) {
        const schedule = await prisma.scriptSchedule.findUnique({ where: { id: scheduleId, workspaceId } });
        if (!schedule) throw Object.assign(new Error('Schedule not found'), { statusCode: 404 });

        const updateData: Prisma.ScriptScheduleUpdateInput = { ...data };

        if (data.cronExpression && data.cronExpression !== schedule.cronExpression) {
            try {
                const interval = CronExpressionParser.parse(data.cronExpression);
                updateData.nextRunAt = interval.next().toDate();
            } catch {
                throw Object.assign(new Error('Invalid cron expression'), { statusCode: 400 });
            }
        } else if (data.enabled === true && schedule.enabled === false) {
            try {
                const interval = CronExpressionParser.parse(schedule.cronExpression);
                updateData.nextRunAt = interval.next().toDate();
            } catch { /* safe fallback — expression was valid before */ }
        }

        return prisma.scriptSchedule.update({
            where: { id: scheduleId }, data: updateData,
            include: { script: { select: { id: true, name: true, language: true } } },
        });
    }

    static async deleteSchedule(workspaceId: string, scheduleId: string) {
        const schedule = await prisma.scriptSchedule.findUnique({ where: { id: scheduleId, workspaceId } });
        if (!schedule) throw Object.assign(new Error('Schedule not found'), { statusCode: 404 });
        await prisma.scriptSchedule.delete({ where: { id: scheduleId } });
        return { message: 'Schedule deleted successfully' };
    }

    // ========================================
    // SCRIPT DEPLOY (mass execution)
    // ========================================

    static async deployScript(workspaceId: string, scriptId: string, userId: string, targetAgentIds: string[]) {
        const script = await prisma.script.findUnique({ where: { id: scriptId, workspaceId } });
        if (!script) throw Object.assign(new Error('Script template not found.'), { statusCode: 404 });

        const targetAgents = await prisma.agentConnection.findMany({
            where: { id: { in: targetAgentIds }, workspaceId, status: 'ONLINE' },
            select: { id: true, assetId: true, hostname: true },
        });

        if (targetAgents.length === 0) {
            throw Object.assign(
                new Error('None of the provided agents are currently ONLINE or available in this workspace.'),
                { statusCode: 400 }
            );
        }

        const executionsData = targetAgents.map((agent) => ({
            workspaceId, agentId: agent.id, assetId: agent.assetId,
            scriptId: script.id, scriptName: script.name,
            scriptBody: script.content, language: script.language,
            status: 'PENDING' as const, createdBy: userId,
        }));

        await prisma.scriptExecution.createMany({ data: executionsData });

        const spawnedExecutions = await prisma.scriptExecution.findMany({
            where: { scriptId: script.id, agentId: { in: targetAgents.map((a) => a.id) }, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: targetAgents.length,
        });

        await prisma.auditLog.create({
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
    }
}
