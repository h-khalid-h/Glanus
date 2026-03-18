import { ApiError } from '@/lib/errors';
/**
 * ScriptScheduleService — Manages the cron-driven script scheduling system.
 *
 * Responsibilities:
 *  - listSchedules: fetch all schedules for a workspace
 *  - createSchedule: validate cron expression, compute nextRunAt, persist
 *  - updateSchedule: patch schedule fields, recompute nextRunAt on expression/enabled change
 *  - deleteSchedule: remove a schedule record
 *  - evaluateSchedules: cron-invoked — find due schedules, generate PENDING executions, update nextRunAt
 *  - getCronStatus: status snapshot of the scheduling system for ops dashboards
 *
 * Note: script CRUD and manual deploy live in ScriptService.
 */
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logInfo, logError } from '@/lib/logger';
import { CronExpressionParser } from 'cron-parser';

export class ScriptScheduleService {
    /**
     * List all schedules in the workspace, newest first.
     */
    static async listSchedules(workspaceId: string) {
        return prisma.scriptSchedule.findMany({
            where: { workspaceId },
            include: { script: { select: { id: true, name: true, language: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Create a new schedule. Validates the script exists and parses the cron expression.
     */
    static async createSchedule(
        workspaceId: string,
        data: { name: string; description?: string; scriptId: string; targetIds: string[]; cronExpression: string }
    ) {
        const script = await prisma.script.findFirst({ where: { id: data.scriptId, workspaceId } });
        if (!script) throw new ApiError(404, 'Script not found');

        let nextRunAt: Date;
        try {
            const interval = CronExpressionParser.parse(data.cronExpression);
            nextRunAt = interval.next().toDate();
        } catch {
            throw new ApiError(400, 'Invalid cron expression');
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

    /**
     * Update schedule fields. Recomputes nextRunAt if cronExpression changes or schedule is re-enabled.
     */
    static async updateSchedule(
        workspaceId: string,
        scheduleId: string,
        data: { name?: string; description?: string; targetIds?: string[]; cronExpression?: string; enabled?: boolean }
    ) {
        const schedule = await prisma.scriptSchedule.findUnique({ where: { id: scheduleId, workspaceId } });
        if (!schedule) throw new ApiError(404, 'Schedule not found');

        const updateData: Prisma.ScriptScheduleUpdateInput = { ...data };

        if (data.cronExpression && data.cronExpression !== schedule.cronExpression) {
            try {
                const interval = CronExpressionParser.parse(data.cronExpression);
                updateData.nextRunAt = interval.next().toDate();
            } catch {
                throw new ApiError(400, 'Invalid cron expression');
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

    /**
     * Delete a schedule.
     */
    static async deleteSchedule(workspaceId: string, scheduleId: string) {
        const schedule = await prisma.scriptSchedule.findUnique({ where: { id: scheduleId, workspaceId } });
        if (!schedule) throw new ApiError(404, 'Schedule not found');
        await prisma.scriptSchedule.delete({ where: { id: scheduleId } });
        return { message: 'Schedule deleted successfully' };
    }

    /**
     * Cron-invoked: find all due schedules, generate PENDING executions for each target agent,
     * then advance nextRunAt. Safe to call concurrently (Prisma update is atomic per schedule).
     */
    static async evaluateSchedules() {
        logInfo('[SERVICE] Starting script execution scheduler...');
        const startTime = Date.now();
        const now = new Date();

        const dueSchedules = await prisma.scriptSchedule.findMany({
            where: { enabled: true, nextRunAt: { lte: now } },
            include: { script: true },
        });

        if (!dueSchedules.length) {
            return { schedulesProcessed: 0, executionsQueued: 0, errors: 0, durationMs: Date.now() - startTime };
        }

        // ── Batch agent lookup: 1 SELECT instead of N SELECTs ─────────────────
        const allTargetIds = [...new Set(dueSchedules.flatMap((s) => (s.targetIds as string[])))];
        const allAgents = await prisma.agentConnection.findMany({
            where: { id: { in: allTargetIds } },
            select: { id: true, assetId: true },
        });
        const agentMap = new Map(allAgents.map((a) => [a.id, a]));

        let executionsQueued = 0;
        let schedulesProcessed = 0;
        let errors = 0;

        for (const schedule of dueSchedules) {
            try {
                const targetIds = schedule.targetIds as string[];

                if (targetIds && targetIds.length > 0) {
                    const agents = targetIds.map((id) => agentMap.get(id)).filter(Boolean) as typeof allAgents;

                    if (agents.length > 0) {
                        // Batch insert all executions in a single query
                        await prisma.scriptExecution.createMany({
                            data: agents.map((agent) => ({
                                scriptId: schedule.scriptId,
                                scriptName: schedule.script.name,
                                scriptBody: schedule.script.content,
                                language: schedule.script.language,
                                agentId: agent.id,
                                assetId: agent.assetId,
                                workspaceId: schedule.workspaceId,
                                status: 'PENDING' as const,
                                createdBy: 'system_cron',
                            })),
                        });
                        executionsQueued += agents.length;
                        logInfo(`[SERVICE] Dispatched schedule ${schedule.id} (${schedule.name}) to ${agents.length} agents.`);
                    }
                }

                let nextRunAt: Date | null = null;
                let disableSchedule = false;
                try {
                    const interval = CronExpressionParser.parse(schedule.cronExpression, { currentDate: now });
                    nextRunAt = interval.next().toDate();
                } catch (err) {
                    logError(`[SERVICE] Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression} — disabling schedule`, err);
                    disableSchedule = true;
                }

                await prisma.scriptSchedule.update({
                    where: { id: schedule.id },
                    data: {
                        lastRunAt: now,
                        nextRunAt,
                        runCount: { increment: 1 },
                        ...(disableSchedule ? { enabled: false } : {}),
                    },
                });

                schedulesProcessed++;
            } catch (err) {
                logError(`[SERVICE] Failed to process schedule ${schedule.id}`, err);
                errors++;
            }
        }

        const duration = Date.now() - startTime;
        const stats = { schedulesProcessed, executionsQueued, errors, durationMs: duration };
        logInfo('[SERVICE] Script scheduler complete', stats);
        return stats;
    }

    /**
     * Returns a status snapshot of the cron scheduling system for ops dashboards.
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
}
