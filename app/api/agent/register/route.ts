import { apiSuccess, apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';

// Validation schema
const registerSchema = z.object({
    assetId: z.string(),
    workspaceId: z.string(),
    hostname: z.string(),
    platform: z.enum(['WINDOWS', 'MACOS', 'LINUX']),
    ipAddress: z.string().optional(),
    macAddress: z.string().optional(),
    agentVersion: z.string(),
    systemInfo: z.object({
        cpu: z.string(),
        ram: z.number(),
        disk: z.number(),
        os: z.string(),
    }).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = registerSchema.parse(body);

        // Verify asset exists and belongs to workspace
        const asset = await prisma.asset.findFirst({
            where: {
                id: data.assetId,
                workspaceId: data.workspaceId,
            },
        });

        if (!asset) {
            return apiError(404, 'Asset not found or does not belong to workspace');
        }

        // Check if agent already exists for this asset
        const existingAgent = await prisma.agentConnection.findUnique({
            where: { assetId: data.assetId },
        });

        if (existingAgent) {
            // Update existing agent
            const updatedAgent = await prisma.agentConnection.update({
                where: { id: existingAgent.id },
                data: {
                    agentVersion: data.agentVersion,
                    hostname: data.hostname,
                    ipAddress: data.ipAddress,
                    macAddress: data.macAddress,
                    platform: data.platform,
                    lastSeen: new Date(),
                    status: 'ONLINE',
                },
            });

            return apiSuccess({
                agentId: updatedAgent.id,
                authToken: updatedAgent.authToken,
                config: {
                    metricsInterval: 300, // 5 minutes
                    heartbeatInterval: 60, // 1 minute
                },
            });
        }

        // Generate secure auth token
        const authToken = crypto.randomBytes(32).toString('hex');

        // Create new agent connection
        const agent = await prisma.agentConnection.create({
            data: {
                assetId: data.assetId,
                workspaceId: data.workspaceId,
                agentVersion: data.agentVersion,
                platform: data.platform,
                hostname: data.hostname,
                ipAddress: data.ipAddress,
                macAddress: data.macAddress,
                authToken,
                status: 'ONLINE',
            },
        });

        // Update asset with system info if provided
        if (data.systemInfo) {
            await prisma.asset.update({
                where: { id: data.assetId },
                data: {
                    manufacturer: data.systemInfo.cpu.split(' ')[0], // Extract brand
                    description: `OS: ${data.systemInfo.os}\nCPU: ${data.systemInfo.cpu}\nRAM: ${data.systemInfo.ram}GB\nDisk: ${data.systemInfo.disk}GB`,
                },
            });
        }

        return apiSuccess({
            agentId: agent.id,
            authToken: agent.authToken,
            config: {
                metricsInterval: 300, // 5 minutes
                heartbeatInterval: 60, // 1 minute
            },
        });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return apiError(400, 'Validation failed', error.errors);
        }

        logError('Agent registration failed', error);
        return apiError(500, 'Failed to register agent');
    }
}
