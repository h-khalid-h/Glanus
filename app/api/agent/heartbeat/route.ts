import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { hashAgentToken } from '@/lib/security/agent-auth';
import { withRateLimit } from '@/lib/security/rateLimit';

// Validation schema
const heartbeatSchema = z.object({
    agentId: z.string().optional(),
    authToken: z.string(),
    metrics: z.object({
        cpu: z.number().min(0).max(100),
        cpuTemp: z.number().optional(),
        ram: z.number().min(0).max(100),
        ramUsed: z.number(),
        ramTotal: z.number(),
        disk: z.number().min(0).max(100),
        diskUsed: z.number(),
        diskTotal: z.number(),
        networkUp: z.number(),
        networkDown: z.number(),
        topProcesses: z.array(z.object({
            name: z.string(),
            cpu: z.number(),
            ram: z.number(),
            pid: z.number().optional(),
        })).optional(),
    }),
});

export async function POST(request: NextRequest) {
    try {
        // Rate limit — high-frequency endpoint, use generous 'api' tier
        const rateLimitResponse = await withRateLimit(request, 'api');
        if (rateLimitResponse) return rateLimitResponse;

        const body = await request.json();
        const data = heartbeatSchema.parse(body);

        // Find agent by hashed auth token
        const hashedToken = hashAgentToken(data.authToken);
        const agent = await prisma.agentConnection.findUnique({
            where: { authToken: hashedToken },
            include: {
                scripts: {
                    where: { status: 'PENDING' },
                    take: 10,
                },
            },
        });

        if (!agent) {
            return apiError(401, 'Invalid auth token');
        }

        // Update agent's last seen and latest metrics
        await prisma.agentConnection.update({
            where: { id: agent.id },
            data: {
                lastSeen: new Date(),
                status: 'ONLINE',
                cpuUsage: data.metrics.cpu,
                ramUsage: data.metrics.ram,
                diskUsage: data.metrics.disk,
                networkUp: data.metrics.networkUp,
                networkDown: data.metrics.networkDown,
            },
        });

        // Store historical metrics
        await prisma.agentMetric.create({
            data: {
                agentId: agent.id,
                assetId: agent.assetId,
                cpuUsage: data.metrics.cpu,
                cpuTemp: data.metrics.cpuTemp,
                ramUsage: data.metrics.ram,
                ramUsed: data.metrics.ramUsed,
                ramTotal: data.metrics.ramTotal,
                diskUsage: data.metrics.disk,
                diskUsed: data.metrics.diskUsed,
                diskTotal: data.metrics.diskTotal,
                networkUp: data.metrics.networkUp,
                networkDown: data.metrics.networkDown,
                topProcesses: data.metrics.topProcesses || [],
            },
        });

        // Format pending scripts as commands
        const commands = agent.scripts.map((script) => ({
            type: 'execute_script',
            id: script.id,
            scriptName: script.scriptName,
            script: script.scriptBody,
            language: script.language,
        }));

        // Mark scripts as running
        if (commands.length > 0) {
            await prisma.scriptExecution.updateMany({
                where: {
                    id: { in: commands.map((c) => c.id) },
                },
                data: {
                    status: 'RUNNING',
                    startedAt: new Date(),
                },
            });
        }

        return apiSuccess({
            status: 'ok',
            agentId: agent.id,
            commands,
        });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return apiError(400, 'Validation failed', error.errors);
        }

        logError('Agent heartbeat failed', error);
        return apiError(500, 'Failed to process heartbeat');
    }
}
