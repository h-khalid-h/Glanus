/** @jest-environment node */
import { buildRiskProfile } from '@/lib/cortex/reasoning';
import type { OperationalGraphData } from '@/lib/nerve/operational-graph';

// Mock getBlastRadius so we can deterministically test the connectivity factor
jest.mock('@/lib/nerve/operational-graph', () => ({
    getBlastRadius: jest.fn((graph, id) => {
        // Return a mock blast radius based on the asset ID
        if (id === 'asset-high-blast') return Array(10).fill('mock-id'); // Size 10
        if (id === 'asset-low-blast') return ['mock-id']; // Size 1
        return [];
    }),
}));

describe('CORTEX Causal Reasoning - Risk Profiling', () => {
    const baseGraph: OperationalGraphData = {
        nodes: [],
        edges: [],
        summary: { totalNodes: 0, totalEdges: 0, healthyNodes: 0, degradedNodes: 0, criticalNodes: 0 }
    };

    it('should generate a low risk score for a completely healthy system', async () => {
        const graph: OperationalGraphData = {
            ...baseGraph,
            nodes: [{
                id: 'asset-healthy',
                label: 'Healthy Server',
                type: 'asset',
                health: 100, // Perfect health
                status: 'online',
                metadata: {
                    cpuUsage: 20, // Low CPU
                    diskUsage: 30, // Low Disk
                }
            }]
        };

        const profile = await buildRiskProfile('asset-healthy', graph);

        // Connectivity: 0 (0 weight), Health: 100 -> 0 risk (0.35 weight), CPU: 20 -> 20 risk (0.2), Disk: 30 -> 30 risk (0.2)
        // Weighted average should result in a very low score
        expect(profile.riskScore).toBeLessThan(30);
        expect(profile.trendDirection).toBe('stable');

        // Assert individual factors
        const healthFactor = profile.factors.find(f => f.name === 'System Health');
        expect(healthFactor?.status).toBe('healthy');
        expect(healthFactor?.currentValue).toBe(100);

        const cpuFactor = profile.factors.find(f => f.name === 'CPU Utilization');
        expect(cpuFactor?.status).toBe('healthy');
    });

    it('should generate a high risk score for a degraded system with high blast radius', async () => {
        const graph: OperationalGraphData = {
            ...baseGraph,
            nodes: [{
                id: 'asset-high-blast',
                label: 'Core Database',
                type: 'asset',
                health: 30, // Critical health
                status: 'degraded',
                metadata: {
                    cpuUsage: 95, // Critical CPU
                    diskUsage: 90, // Critical Disk
                }
            }, {
                id: 'agent-1',
                label: 'Agent',
                type: 'agent',
                health: 40, // Agent is also failing
                status: 'degraded',
                metadata: {}
            }],
            edges: [
                { source: 'agent-1', target: 'asset-high-blast', type: 'MONITORS', label: 'monitors' }
            ]
        };

        const profile = await buildRiskProfile('asset-high-blast', graph);

        // Should trigger max risk thresholds across the board
        expect(profile.riskScore).toBeGreaterThan(80);

        // Since agent health is 40, trend should be degrading
        expect(profile.trendDirection).toBe('degrading');

        const healthFactor = profile.factors.find(f => f.name === 'System Health');
        expect(healthFactor?.status).toBe('critical');

        const connectivityFactor = profile.factors.find(f => f.name === 'Dependency Exposure');
        expect(connectivityFactor?.status).toBe('critical');
    });

    it('should calculate improving trends if the monitoring agent is highly healthy', async () => {
        const graph: OperationalGraphData = {
            ...baseGraph,
            nodes: [{
                id: 'asset-low-blast',
                label: 'Web Server',
                type: 'asset',
                health: 60, // Warning health
                status: 'warning',
                metadata: {}
            }, {
                id: 'agent-2',
                label: 'Agent',
                type: 'agent',
                health: 95, // Agent is extremely healthy
                status: 'online',
                metadata: {}
            }],
            edges: [
                { source: 'agent-2', target: 'asset-low-blast', type: 'MONITORS', label: 'monitors' }
            ]
        };

        const profile = await buildRiskProfile('asset-low-blast', graph);

        // Agent is healthy, thus trend is improving despite asset being in warning state
        expect(profile.trendDirection).toBe('improving');

        const healthFactor = profile.factors.find(f => f.name === 'System Health');
        expect(healthFactor?.status).toBe('warning');
    });

    it('should throw an error if the requested asset does not exist in the graph', async () => {
        await expect(buildRiskProfile('non-existent-asset', baseGraph)).rejects.toThrow('Asset non-existent-asset not found');
    });
});
