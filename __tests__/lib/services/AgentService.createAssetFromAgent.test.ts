/**
 * @jest-environment node
 */
/**
 * AgentService.createAssetFromAgent — Unit Tests
 *
 * Verifies workspace isolation, duplicate-link prevention, and the
 * default-mapping contract (hostname → asset name, auto description, etc).
 */

const mockAgentFindFirst = jest.fn();
const mockAgentUpdate = jest.fn();
const mockAssetCreate = jest.fn();
const mockAuditLogCreate = jest.fn().mockResolvedValue(undefined);

// prisma.$transaction invokes its callback with a tx object whose methods
// we route back to the same mocks (consistent with the real transactional
// boundary — the assertion cares about what got called, not which client).
const mockTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
        asset: { create: (...args: unknown[]) => mockAssetCreate(...args) },
        agentConnection: { update: (...args: unknown[]) => mockAgentUpdate(...args) },
    };
    return fn(tx);
});

jest.mock('@/lib/db', () => ({
    prisma: {
        agentConnection: {
            findFirst: (...args: unknown[]) => mockAgentFindFirst(...args),
            update: (...args: unknown[]) => mockAgentUpdate(...args),
        },
        asset: { create: (...args: unknown[]) => mockAssetCreate(...args) },
        $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
    },
}));

jest.mock('@/lib/workspace/auditLog', () => ({
    auditLog: (...args: unknown[]) => mockAuditLogCreate(...args),
}));

import { AgentService } from '@/lib/services/AgentService';
import { ApiError } from '@/lib/errors';

describe('AgentService.createAssetFromAgent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const baseAgent = {
        id: 'agent-1',
        assetId: null,
        hostname: 'srv-01',
        platform: 'LINUX',
        ipAddress: '10.0.0.5',
        macAddress: 'aa:bb:cc:dd:ee:ff',
        agentVersion: '0.1.0',
    };

    it('throws 404 when agent is not found in workspace', async () => {
        mockAgentFindFirst.mockResolvedValue(null);

        await expect(
            AgentService.createAssetFromAgent({
                agentId: 'missing',
                workspaceId: 'ws-1',
                userId: 'user-1',
            }),
        ).rejects.toMatchObject({ statusCode: 404 });

        expect(mockAssetCreate).not.toHaveBeenCalled();
    });

    it('enforces workspace isolation in the findFirst query', async () => {
        mockAgentFindFirst.mockResolvedValue(null);

        await expect(
            AgentService.createAssetFromAgent({
                agentId: 'agent-1',
                workspaceId: 'ws-1',
                userId: 'user-1',
            }),
        ).rejects.toBeInstanceOf(ApiError);

        expect(mockAgentFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'agent-1', workspaceId: 'ws-1' },
            }),
        );
    });

    it('throws 409 when the agent is already linked to an asset', async () => {
        mockAgentFindFirst.mockResolvedValue({ ...baseAgent, assetId: 'asset-existing' });

        await expect(
            AgentService.createAssetFromAgent({
                agentId: 'agent-1',
                workspaceId: 'ws-1',
                userId: 'user-1',
            }),
        ).rejects.toMatchObject({ statusCode: 409 });

        expect(mockAssetCreate).not.toHaveBeenCalled();
        expect(mockAgentUpdate).not.toHaveBeenCalled();
    });

    it('creates asset with hostname as default name and links it to the agent', async () => {
        mockAgentFindFirst.mockResolvedValue(baseAgent);
        mockAssetCreate.mockResolvedValue({
            id: 'asset-new',
            name: 'srv-01',
            assetType: 'PHYSICAL',
            status: 'ASSIGNED',
            workspaceId: 'ws-1',
            description: 'auto',
            location: null,
        });
        mockAgentUpdate.mockResolvedValue({});

        const result = await AgentService.createAssetFromAgent({
            agentId: 'agent-1',
            workspaceId: 'ws-1',
            userId: 'user-1',
        });

        // Asset created in the requested workspace with hostname-derived name
        expect(mockAssetCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: 'srv-01',
                    workspaceId: 'ws-1',
                    assetType: 'PHYSICAL',
                    status: 'ASSIGNED',
                }),
            }),
        );
        // Agent linked to the newly created asset
        expect(mockAgentUpdate).toHaveBeenCalledWith({
            where: { id: 'agent-1' },
            data: { assetId: 'asset-new' },
        });
        // Audit trail recorded
        expect(mockAuditLogCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'asset.created',
                workspaceId: 'ws-1',
                userId: 'user-1',
                resourceId: 'asset-new',
                details: expect.objectContaining({ source: 'agent', agentId: 'agent-1' }),
            }),
        );
        expect(result.agent).toEqual({ id: 'agent-1', assetId: 'asset-new' });
        expect(result.asset.id).toBe('asset-new');
    });

    it('honors overrides (name, assetType, location)', async () => {
        mockAgentFindFirst.mockResolvedValue(baseAgent);
        mockAssetCreate.mockResolvedValue({
            id: 'asset-new',
            name: 'Custom Name',
            assetType: 'DIGITAL',
            status: 'ASSIGNED',
            workspaceId: 'ws-1',
            description: 'from-override',
            location: 'DC1',
        });

        await AgentService.createAssetFromAgent({
            agentId: 'agent-1',
            workspaceId: 'ws-1',
            userId: 'user-1',
            overrides: {
                name: 'Custom Name',
                assetType: 'DIGITAL',
                location: 'DC1',
                description: 'from-override',
            },
        });

        expect(mockAssetCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: 'Custom Name',
                    assetType: 'DIGITAL',
                    location: 'DC1',
                    description: 'from-override',
                }),
            }),
        );
    });
});
