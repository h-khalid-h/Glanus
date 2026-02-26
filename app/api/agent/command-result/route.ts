import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema
const commandResultSchema = z.object({
    authToken: z.string(),
    executionId: z.string(),
    status: z.enum(['completed', 'failed', 'timeout']),
    exitCode: z.number().optional(),
    output: z.string().optional(),
    error: z.string().optional(),
    duration: z.number().optional(), // milliseconds
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = commandResultSchema.parse(body);

        // Verify agent auth
        const agent = await prisma.agentConnection.findUnique({
            where: { authToken: data.authToken },
        });

        if (!agent) {
            return apiError(401, 'Invalid auth token');
        }

        // Find script execution
        const execution = await prisma.scriptExecution.findUnique({
            where: { id: data.executionId },
        });

        if (!execution) {
            return apiError(404, 'Execution not found');
        }

        // Verify execution belongs to this agent
        if (execution.agentId !== agent.id) {
            return apiError(403, 'Execution does not belong to this agent');
        }

        // Map status to ScriptStatus enum
        const statusMap: Record<string, 'COMPLETED' | 'FAILED' | 'TIMEOUT'> = {
            completed: 'COMPLETED',
            failed: 'FAILED',
            timeout: 'TIMEOUT',
        };

        // Update execution with result
        await prisma.scriptExecution.update({
            where: { id: data.executionId },
            data: {
                status: statusMap[data.status],
                exitCode: data.exitCode,
                output: data.output,
                error: data.error,
                completedAt: new Date(),
            },
        });

        return apiSuccess({
            status: 'ok',
            message: 'Result recorded successfully',
        });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return apiError(400, 'Validation failed', error.errors);
        }

        logError('Agent command result failed', error);
        return apiError(500, 'Failed to record result');
    }
}
