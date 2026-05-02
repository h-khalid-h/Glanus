import { ApiError } from '@/lib/errors';
/**
 * AgentService — Manages agent lifecycle and telemetry.
 *
 * Responsibilities:
 *  - registerAgent: enroll a new agent connection with a hashed token
 *  - heartbeat: process real-time CPU/RAM/disk metrics and status updates
 *  - processCommandResult: handle command execution results from agents
 *  - discoverSoftware / discoverNetwork: process discovery payloads
 */
import { prisma } from '@/lib/db';
import { generateAgentToken, hashAgentToken } from '@/lib/security/agent-auth';
import { signCommandPayload, signUpdatePayload } from '@/lib/security/agent-signing';
import { AgentPlatform, AssetType } from '@prisma/client';
import { auditLog } from '@/lib/workspace/auditLog';

// ============================================
// INPUT TYPES
// ============================================

export interface RegisterAgentInput {
    assetId?: string;
    workspaceId: string;
    hostname: string;
    platform: AgentPlatform;
    ipAddress?: string;
    macAddress?: string;
    agentVersion: string;
    systemInfo?: {
        cpu: string;
        ram: number;
        disk: number;
        os: string;
    };
}

export interface HeartbeatMetrics {
    cpu: number;
    cpuTemp?: number;
    ram: number;
    ramUsed: number;
    ramTotal: number;
    disk: number;
    diskUsed: number;
    diskTotal: number;
    networkUp: number;
    networkDown: number;
    topProcesses?: Array<{ name: string; cpu: number; ram: number; pid?: number }>;
}

export interface CommandResultInput {
    authToken: string;
    executionId: string;
    status: 'completed' | 'failed' | 'timeout';
    exitCode?: number | null;
    output?: string | null;
    error?: string | null;
    duration?: number | null;
}

export interface SoftwareItem {
    name: string;
    version?: string;
    publisher?: string;
    installDate?: Date;
    sizeMB?: number;
}

export interface DiscoveryDevice {
    ipAddress: string;
    macAddress?: string;
    hostname?: string;
    deviceType: string;
    snmpData?: Record<string, unknown>;
}

export interface CreateAssetFromAgentInput {
    agentId: string;
    workspaceId: string;
    userId: string;
    overrides?: {
        name?: string;
        assetType?: AssetType;
        location?: string;
        description?: string;
    };
    ipAddress?: string;
    userAgent?: string;
}

// ============================================
// AGENT SERVICE
// ============================================

/**
 * AgentService — Domain layer for all RMM Agent lifecycle operations.
 *
 * Encapsulates:
 *   - Agent registration and re-registration with secure token generation
 *   - Heartbeat processing with the Prism Deduplication Engine
 *   - Script command dispatch and execution result recording
 *   - Software inventory synchronization (wipe-and-replace pattern)
 *   - Network discovery submission and device upsert logic
 *   - Version update checks using semantic versioning
 *   - Active remote session lookup for agent webviews
 */
export class AgentService {

    private static async claimPendingScriptCommands(agentId: string): Promise<Array<{ id: string; scriptName: string; scriptBody: string; language: string }>> {
        const pending = await prisma.scriptExecution.findMany({
            where: { agentId, status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            take: 10,
            select: { id: true },
        });

        if (pending.length === 0) return [];

        const pendingIds = pending.map((p) => p.id);
        const dispatchTime = new Date();

        await prisma.scriptExecution.updateMany({
            where: {
                id: { in: pendingIds },
                status: 'PENDING',
            },
            data: {
                status: 'RUNNING',
                startedAt: dispatchTime,
            },
        });

        return prisma.scriptExecution.findMany({
            where: {
                id: { in: pendingIds },
                status: 'RUNNING',
                startedAt: dispatchTime,
            },
            select: {
                id: true,
                scriptName: true,
                scriptBody: true,
                language: true,
            },
        });
    }

    // ========================================
    // AGENT REGISTRATION
    // ========================================

    /**
     * Registers a new agent or re-registers an existing one.
     * Returns a plaintext auth token (only returned once) and config.
     */
    static async registerAgent(data: RegisterAgentInput): Promise<{
        agentId: string;
        assetId: string;
        authToken: string;
        config: { metricsInterval: number; heartbeatInterval: number };
    }> {
        // Verify workspace exists
        const workspace = await prisma.workspace.findUnique({
            where: { id: data.workspaceId },
            select: { id: true },
        });
        if (!workspace) {
            throw new ApiError(404, 'Workspace not found');
        }

        // Resolve the target asset: look up by explicit id, by hostname match,
        // or create a new one for self-enrolling agents.
        let assetId = data.assetId;
        if (assetId) {
            const asset = await prisma.asset.findFirst({
                where: { id: assetId, workspaceId: data.workspaceId, deletedAt: null },
            });
            if (!asset) {
                throw new ApiError(404, 'Asset not found or does not belong to workspace');
            }
        } else {
            // Try to match an existing asset by hostname (via its linked agent connection)
            // so a reinstall doesn't create duplicates.
            const existingByHostname = await prisma.agentConnection.findFirst({
                where: { workspaceId: data.workspaceId, hostname: data.hostname },
                select: { assetId: true },
            });
            if (existingByHostname) {
                assetId = existingByHostname.assetId;
            } else {
                const created = await prisma.asset.create({
                    data: {
                        name: data.hostname,
                        workspaceId: data.workspaceId,
                        assetType: 'PHYSICAL',
                        status: 'ASSIGNED',
                        description: data.systemInfo
                            ? `Auto-enrolled by Glanus Agent\nOS: ${data.systemInfo.os}\nCPU: ${data.systemInfo.cpu}\nRAM: ${data.systemInfo.ram}GB\nDisk: ${data.systemInfo.disk}GB`
                            : 'Auto-enrolled by Glanus Agent',
                    },
                    select: { id: true },
                });
                assetId = created.id;
            }
        }

        const config = { metricsInterval: 300, heartbeatInterval: 60 };

        // Check for existing agent (re-registration)
        const existingAgent = await prisma.agentConnection.findFirst({
            where: {
                assetId,
                workspaceId: data.workspaceId,
                hostname: data.hostname,
                ...(data.macAddress ? { macAddress: data.macAddress } : {}),
            },
        });

        if (existingAgent) {
            const { plaintext, hash } = generateAgentToken();
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
                    authToken: hash,
                },
            });
            return { agentId: updatedAgent.id, assetId, authToken: plaintext, config };
        }

        // New registration
        const { plaintext, hash } = generateAgentToken();
        const agent = await prisma.agentConnection.create({
            data: {
                assetId,
                workspaceId: data.workspaceId,
                agentVersion: data.agentVersion,
                platform: data.platform,
                hostname: data.hostname,
                ipAddress: data.ipAddress,
                macAddress: data.macAddress,
                authToken: hash,
                status: 'ONLINE',
            },
        });

        // Optionally update asset system info
        if (data.systemInfo) {
            await prisma.asset.update({
                where: { id: assetId },
                data: {
                    manufacturer: data.systemInfo.cpu.split(' ')[0],
                    description: `OS: ${data.systemInfo.os}\nCPU: ${data.systemInfo.cpu}\nRAM: ${data.systemInfo.ram}GB\nDisk: ${data.systemInfo.disk}GB`,
                },
            });
        }

        return { agentId: agent.id, assetId, authToken: plaintext, config };
    }

    // ========================================
    // CREATE ASSET FROM AGENT
    // ========================================

    /**
     * Create a new Asset from an existing unlinked AgentConnection and link them.
     *
     * Enforces:
     *   - Agent exists within the requested workspace (tenant isolation)
     *   - Agent is not already linked to an asset (conflict → 409)
     *
     * Mapping defaults:
     *   - name          → agent.hostname
     *   - assetType     → PHYSICAL (override allowed)
     *   - status        → ASSIGNED (agent is actively reporting)
     *   - description   → derived from agent platform/host (override allowed)
     *
     * @throws ApiError(404) if agent not found in workspace
     * @throws ApiError(409) if agent is already linked to an asset
     */
    static async createAssetFromAgent(input: CreateAssetFromAgentInput): Promise<{
        agent: { id: string; assetId: string };
        asset: {
            id: string;
            name: string;
            assetType: AssetType;
            status: string;
            workspaceId: string;
            description: string | null;
            location: string | null;
        };
    }> {
        const { agentId, workspaceId, userId, overrides, ipAddress, userAgent } = input;

        const agent = await prisma.agentConnection.findFirst({
            where: { id: agentId, workspaceId },
            select: {
                id: true,
                assetId: true,
                hostname: true,
                platform: true,
                ipAddress: true,
                macAddress: true,
                agentVersion: true,
            },
        });
        if (!agent) {
            throw new ApiError(404, 'Agent not found');
        }
        if (agent.assetId) {
            throw new ApiError(409, 'Agent is already linked to an asset');
        }

        const name = overrides?.name?.trim() || agent.hostname;
        const assetType: AssetType = overrides?.assetType ?? AssetType.PHYSICAL;
        const description = overrides?.description
            ?? `Created from Agent\nHostname: ${agent.hostname}\nPlatform: ${agent.platform}` +
               (agent.ipAddress ? `\nIP: ${agent.ipAddress}` : '') +
               (agent.macAddress ? `\nMAC: ${agent.macAddress}` : '') +
               `\nAgent Version: ${agent.agentVersion}`;

        // Atomic: create the asset and link it to the agent in one transaction.
        const result = await prisma.$transaction(async (tx) => {
            const asset = await tx.asset.create({
                data: {
                    name,
                    workspaceId,
                    assetType,
                    status: 'ASSIGNED',
                    location: overrides?.location ?? null,
                    description,
                },
                select: {
                    id: true,
                    name: true,
                    assetType: true,
                    status: true,
                    workspaceId: true,
                    description: true,
                    location: true,
                },
            });

            await tx.agentConnection.update({
                where: { id: agent.id },
                data: { assetId: asset.id },
            });

            return asset;
        });

        await auditLog({
            workspaceId,
            userId,
            action: 'asset.created',
            resourceType: 'asset',
            resourceId: result.id,
            details: {
                source: 'agent',
                agentId: agent.id,
                hostname: agent.hostname,
                platform: agent.platform,
            },
            ipAddress,
            userAgent,
        });

        return {
            agent: { id: agent.id, assetId: result.id },
            asset: result,
        };
    }

    // ========================================
    // HEARTBEAT (Prism Deduplication Engine)
    // ========================================

    /**
     * Processes an agent heartbeat using the Prism Deduplication Engine.
     * Only saves historical metric snapshots when variance >= 5% OR 5 mins have elapsed.
     * Returns pending script commands for the agent to execute.
     */
    static async processHeartbeat(
        authToken: string,
        metrics: HeartbeatMetrics,
        capabilities?: { remoteDesktop?: boolean },
    ): Promise<{
        agentId: string;
        commands: Array<{
            type: string;
            id: string;
            scriptName: string;
            script: string;
            language: string;
            signature?: string;
            issuedAt?: string;
        }>;
    }> {
        const MAX_VARIANCE = 5;
        const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

        const hashedToken = hashAgentToken(authToken);
        const agent = await prisma.agentConnection.findUnique({
            where: { authToken: hashedToken },
            select: {
                id: true,
                assetId: true,
                cpuUsage: true,
                ramUsage: true,
                diskUsage: true,
                lastMetricSavedAt: true,
            },
        });

        if (!agent) {
            throw new ApiError(401, 'Invalid auth token');
        }

        // Deduplication variance check
        const cpuVariance = Math.abs((agent.cpuUsage ?? 0) - metrics.cpu);
        const ramVariance = Math.abs((agent.ramUsage ?? 0) - metrics.ram);
        const diskVariance = Math.abs((agent.diskUsage ?? 0) - metrics.disk);
        const maxVariance = Math.max(cpuVariance, ramVariance, diskVariance);

        const timeSinceLastSnapshot = agent.lastMetricSavedAt
            ? new Date().getTime() - new Date(agent.lastMetricSavedAt).getTime()
            : Infinity;

        const requiresSnapshot = maxVariance >= MAX_VARIANCE || timeSinceLastSnapshot >= SNAPSHOT_INTERVAL_MS;

        // Build atomic update payload — volatile state always updates
        const updateData: Record<string, unknown> = {
            lastSeen: new Date(),
            status: 'ONLINE',
            cpuUsage: metrics.cpu,
            ramUsage: metrics.ram,
            diskUsage: metrics.disk,
            networkUp: metrics.networkUp,
            networkDown: metrics.networkDown,
        };

        // Capability tracking — agents can toggle `canRemoteAccess` by
        // reporting it in their heartbeat. Keeps UI-facing flags in sync
        // with what the binary actually supports.
        if (capabilities && typeof capabilities.remoteDesktop === 'boolean') {
            updateData.canRemoteAccess = capabilities.remoteDesktop;
        }

        if (requiresSnapshot) {
            updateData.lastMetricSavedAt = new Date();
            // AgentMetric requires a linked asset; skip historical snapshot
            // when agent is unlinked. Volatile fields still update above.
            if (agent.assetId) {
                updateData.metrics = {
                    create: {
                        assetId: agent.assetId,
                        cpuUsage: metrics.cpu,
                        cpuTemp: metrics.cpuTemp,
                        ramUsage: metrics.ram,
                        ramUsed: metrics.ramUsed,
                        ramTotal: metrics.ramTotal,
                        diskUsage: metrics.disk,
                        diskUsed: metrics.diskUsed,
                        diskTotal: metrics.diskTotal,
                        networkUp: metrics.networkUp,
                        networkDown: metrics.networkDown,
                        topProcesses: metrics.topProcesses || [],
                    },
                };
            }
        }

        // Atomic nested write
        await prisma.agentConnection.update({
            where: { id: agent.id },
            data: updateData as Parameters<typeof prisma.agentConnection.update>[0]['data'],
        });

        const claimedScripts = await this.claimPendingScriptCommands(agent.id);

        // Format claimed scripts for command dispatch.
        // If signing is configured, include signature metadata for agent-side verification.
        const commands = claimedScripts.map((script) => {
            const signed = signCommandPayload({
                id: script.id,
                language: script.language,
                script: script.scriptBody,
            });

            return {
                type: 'execute_script',
                id: script.id,
                scriptName: script.scriptName,
                script: script.scriptBody,
                language: script.language,
                ...(signed ? { signature: signed.signature, issuedAt: signed.issuedAt } : {}),
            };
        });

        return { agentId: agent.id, commands };
    }

    /**
     * Mark stale agents offline when they have not heartbeated recently.
     */
    static async markStaleAgentsOffline(staleAfterMinutes = 5): Promise<{ updated: number }> {
        const cutoff = new Date(Date.now() - staleAfterMinutes * 60 * 1000);
        const result = await prisma.agentConnection.updateMany({
            where: {
                status: { in: ['ONLINE', 'INSTALLING', 'UPDATING'] },
                lastSeen: { lt: cutoff },
            },
            data: { status: 'OFFLINE' },
        });

        return { updated: result.count };
    }

    // ========================================
    // COMMAND RESULT
    // ========================================

    /**
     * Records the result of a script execution dispatched to the agent.
     * Verifies the execution belongs to the authenticated agent.
     */
    static async recordCommandResult(input: CommandResultInput): Promise<void> {
        const statusMap: Record<string, 'COMPLETED' | 'FAILED' | 'TIMEOUT'> = {
            completed: 'COMPLETED',
            failed: 'FAILED',
            timeout: 'TIMEOUT',
        };

        const hashedToken = hashAgentToken(input.authToken);
        const agent = await prisma.agentConnection.findUnique({
            where: { authToken: hashedToken },
        });
        if (!agent) {
            throw new ApiError(401, 'Invalid auth token');
        }

        const execution = await prisma.scriptExecution.findUnique({
            where: { id: input.executionId },
        });
        if (!execution) {
            throw new ApiError(404, 'Execution not found');
        }
        if (execution.agentId !== agent.id) {
            throw new ApiError(403, 'Execution does not belong to this agent');
        }

        await prisma.scriptExecution.update({
            where: { id: input.executionId },
            data: {
                status: statusMap[input.status],
                exitCode: input.exitCode,
                output: input.output,
                error: input.error,
                completedAt: new Date(),
            },
        });
    }

    // ========================================
    // VERSION CHECK
    // ========================================

    /**
     * Checks if a newer version of the agent is available for the given platform.
     * Returns null if agent is up-to-date or if no version is published.
     * Uses semantic versioning comparison.
     */
    static async checkForUpdate(currentVersion: string, platform: string): Promise<{
        version: string;
        download_url: string;
        checksum: string;
        signature?: string;
        release_notes: string;
        required: boolean;
    } | null> {
        const normalizedPlatform = platform.toUpperCase();

        const latestVersion = await prisma.agentVersion.findFirst({
            where: { platform: normalizedPlatform, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        });

        if (!latestVersion) return null;

        const currentParts = currentVersion.split('.').map(Number);
        const latestParts = latestVersion.version.split('.').map(Number);

        let isNewer = false;
        for (let i = 0; i < 3; i++) {
            const current = currentParts[i] || 0;
            const latest = latestParts[i] || 0;
            if (latest > current) { isNewer = true; break; }
            else if (latest < current) { break; }
        }

        if (!isNewer) return null;

        const updateSignature = signUpdatePayload(latestVersion.version, latestVersion.checksum);

        return {
            version: latestVersion.version,
            download_url: latestVersion.downloadUrl,
            checksum: latestVersion.checksum,
            ...(updateSignature ? { signature: updateSignature } : {}),
            release_notes: latestVersion.releaseNotes || '',
            required: latestVersion.required || false,
        };
    }

    // ========================================
    // SOFTWARE INVENTORY
    // ========================================

    /**
     * Synchronizes software inventory for an agent using a wipe-and-replace pattern.
     * Authenticates the agent via token before mutation.
     */
    static async syncSoftwareInventory(authToken: string, software: SoftwareItem[]): Promise<{ count: number }> {
        const hashedToken = hashAgentToken(authToken);
        const agent = await prisma.agentConnection.findUnique({
            where: { authToken: hashedToken },
            select: { id: true },
        });
        if (!agent) {
            throw new ApiError(401, 'Invalid auth token');
        }

        await prisma.$transaction([
            prisma.installedSoftware.deleteMany({ where: { agentId: agent.id } }),
            prisma.installedSoftware.createMany({
                data: software.map((sw) => ({
                    agentId: agent.id,
                    name: sw.name.substring(0, 255),
                    version: sw.version?.substring(0, 100) || null,
                    publisher: sw.publisher?.substring(0, 255) || null,
                    installDate: sw.installDate || null,
                    sizeMB: sw.sizeMB || null,
                })),
            }),
        ]);

        return { count: software.length };
    }

    // ========================================
    // NETWORK DISCOVERY
    // ========================================

    /**
     * Processes a network discovery scan submitted by an agent.
     * Deduplicates devices by IP and upserts into the Workspace network ledger.
     */
    static async processDiscovery(authToken: string, subnet: string, devices: DiscoveryDevice[]): Promise<{
        scanId: string;
        count: number;
    }> {
        const hashedToken = hashAgentToken(authToken);
        const agent = await prisma.agentConnection.findUnique({
            where: { authToken: hashedToken },
            select: { id: true, workspaceId: true },
        });
        if (!agent) {
            throw new ApiError(401, 'Invalid auth token');
        }

        const uniqueDevices = Array.from(new Map(devices.map((d) => [d.ipAddress, d])).values());

        const scan = await prisma.discoveryScan.create({
            data: {
                workspaceId: agent.workspaceId,
                agentId: agent.id,
                subnet,
                status: 'COMPLETED',
                devicesFound: uniqueDevices.length,
                startedAt: new Date(),
                completedAt: new Date(),
            },
        });

        // ── Batch upsert: 1 SELECT instead of N SELECTs ──────────────────────
        const incomingIps = uniqueDevices.map((d) => d.ipAddress);
        const existingDevices = await prisma.networkDevice.findMany({
            where: { workspaceId: agent.workspaceId, ipAddress: { in: incomingIps } },
            select: { id: true, ipAddress: true, macAddress: true, hostname: true, deviceType: true, snmpData: true },
        });
        const existingMap = new Map(existingDevices.map((d) => [d.ipAddress, d]));

        const toCreate = uniqueDevices.filter((d) => !existingMap.has(d.ipAddress));
        const toUpdate = uniqueDevices.filter((d) => existingMap.has(d.ipAddress));
        const now = new Date();

        await prisma.$transaction([
            // Batch insert for new devices
            prisma.networkDevice.createMany({
                data: toCreate.map((device) => ({
                    workspaceId: agent.workspaceId,
                    discoveredById: agent.id,
                    ipAddress: device.ipAddress,
                    macAddress: device.macAddress || null,
                    hostname: device.hostname || null,
                    deviceType: device.deviceType,
                    snmpData: device.snmpData ? (device.snmpData as object) : undefined,
                    lastSeen: now,
                })),
                skipDuplicates: true,
            }),
            // Individual updates for existing devices (Prisma lacks updateMany with per-row data)
            ...toUpdate.map((device) => {
                const e = existingMap.get(device.ipAddress)!;
                return prisma.networkDevice.update({
                    where: { id: e.id },
                    data: {
                        macAddress: device.macAddress || e.macAddress,
                        hostname: device.hostname || e.hostname,
                        deviceType: device.deviceType !== 'UNKNOWN' ? device.deviceType : e.deviceType,
                        snmpData: device.snmpData ? (device.snmpData as object) : (e.snmpData as object),
                        lastSeen: now,
                        discoveredById: agent.id,
                    },
                });
            }),
        ]);

        return { scanId: scan.id, count: uniqueDevices.length };
    }

    // ========================================
    // ACTIVE REMOTE SESSION (for agent webview)
    // ========================================

    /**
     * Returns the current active remote session for the agent's asset.
     * Called by the Tauri Agent Webview to poll for pending WebRTC offers.
     */
    static async getActiveRemoteSession(authToken: string): Promise<{
        id: string;
        status: string;
        offer: unknown;
        answer: unknown;
        iceCandidates: unknown;
        viewOnly: boolean;
    } | null> {
        const hashedToken = hashAgentToken(authToken);
        const agent = await prisma.agentConnection.findUnique({
            where: { authToken: hashedToken },
            select: { assetId: true },
        });
        if (!agent) {
            throw new ApiError(401, 'Invalid agent token');
        }

        // No active session is possible without a linked asset.
        if (!agent.assetId) return null;

        const activeSession = await prisma.remoteSession.findFirst({
            where: { assetId: agent.assetId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                status: true,
                offer: true,
                answer: true,
                iceCandidates: true,
                metadata: true,
            },
        });
        if (!activeSession) return null;

        // The agent treats `metadata.viewOnly === true` as authoritative —
        // when true it swaps to a no-op input driver so even a malicious
        // viewer crafting input frames cannot inject events. Default to
        // false (full control) if the metadata is missing or malformed.
        const meta = activeSession.metadata as { viewOnly?: unknown } | null;
        const viewOnly = meta && meta.viewOnly === true;

        return {
            id: activeSession.id,
            status: activeSession.status,
            offer: activeSession.offer,
            answer: activeSession.answer,
            iceCandidates: activeSession.iceCandidates,
            viewOnly,
        };
    }
}
