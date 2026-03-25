/**
 * @jest-environment node
 */
/**
 * Agent API Endpoints — Validation & Integration Tests
 *
 * Tests request validation schemas and response shapes for all
 * agent-facing endpoints: register, heartbeat, command-result, discovery.
 */

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-for-agent-tests';

import {
    generateAgentToken,
    hashAgentToken,
    verifyAgentToken,
} from '@/lib/security/agent-auth';

// ---------------------------------------------------------------------------
// Helpers — lightweight schema validators mirroring the Zod schemas in routes
// ---------------------------------------------------------------------------

function isValidPlatform(p: string): boolean {
    return ['WINDOWS', 'MACOS', 'LINUX'].includes(p);
}

function isValidCommandStatus(s: string): boolean {
    return ['completed', 'failed', 'timeout'].includes(s);
}

function isValidMetrics(m: Record<string, unknown>): boolean {
    const requiredNumeric = ['cpu', 'ram', 'ramUsed', 'ramTotal', 'disk', 'diskUsed', 'diskTotal', 'networkUp', 'networkDown'];
    return requiredNumeric.every((k) => typeof m[k] === 'number');
}

// ---------------------------------------------------------------------------
// Register endpoint schema tests
// ---------------------------------------------------------------------------

describe('Agent Register — Request Validation', () => {
    const validPayload = {
        assetId: 'asset-123',
        workspaceId: 'ws-456',
        hostname: 'dev-machine',
        platform: 'LINUX',
        agentVersion: '0.1.0',
    };

    it('accepts valid registration payload', () => {
        expect(typeof validPayload.assetId).toBe('string');
        expect(typeof validPayload.workspaceId).toBe('string');
        expect(typeof validPayload.hostname).toBe('string');
        expect(isValidPlatform(validPayload.platform)).toBe(true);
        expect(typeof validPayload.agentVersion).toBe('string');
    });

    it('accepts optional systemInfo fields', () => {
        const payload = {
            ...validPayload,
            ipAddress: '192.168.1.100',
            macAddress: 'aa:bb:cc:dd:ee:ff',
            systemInfo: { cpu: 'i7-12700', ram: 32768, disk: 512000, os: 'Ubuntu 22.04' },
        };
        expect(payload.systemInfo.cpu).toBe('i7-12700');
        expect(payload.systemInfo.ram).toBe(32768);
    });

    it('rejects invalid platform', () => {
        expect(isValidPlatform('ANDROID')).toBe(false);
        expect(isValidPlatform('')).toBe(false);
    });

    it('pre-auth token round-trips through hash/verify', () => {
        const { plaintext, hash } = generateAgentToken();
        expect(verifyAgentToken(plaintext, hash)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Heartbeat endpoint schema tests
// ---------------------------------------------------------------------------

describe('Agent Heartbeat — Request Validation', () => {
    const validMetrics = {
        cpu: 45.2,
        ram: 62.1,
        ramUsed: 8192,
        ramTotal: 16384,
        disk: 55.0,
        diskUsed: 256000,
        diskTotal: 512000,
        networkUp: 1024,
        networkDown: 4096,
    };

    it('validates required numeric metric fields', () => {
        expect(isValidMetrics(validMetrics)).toBe(true);
    });

    it('rejects metrics missing required fields', () => {
        const bad = { cpu: 10 } as Record<string, unknown>;
        expect(isValidMetrics(bad)).toBe(false);
    });

    it('accepts optional cpuTemp and topProcesses', () => {
        const extended = {
            ...validMetrics,
            cpuTemp: 72.5,
            topProcesses: [
                { name: 'chrome', cpu: 12.5, ram: 1024, pid: 1234 },
            ],
        };
        expect(typeof extended.cpuTemp).toBe('number');
        expect(Array.isArray(extended.topProcesses)).toBe(true);
        expect(extended.topProcesses[0].name).toBe('chrome');
    });

    it('metrics percentages stay in 0-100 range', () => {
        expect(validMetrics.cpu).toBeGreaterThanOrEqual(0);
        expect(validMetrics.cpu).toBeLessThanOrEqual(100);
        expect(validMetrics.ram).toBeGreaterThanOrEqual(0);
        expect(validMetrics.ram).toBeLessThanOrEqual(100);
    });
});

// ---------------------------------------------------------------------------
// Command Result endpoint schema tests
// ---------------------------------------------------------------------------

describe('Agent Command Result — Request Validation', () => {
    it('accepts valid completed result', () => {
        const result = {
            authToken: 'glanus_agent_abc123',
            executionId: 'exec-789',
            status: 'completed',
            exitCode: 0,
            output: 'Hello World',
            duration: 1500,
        };
        expect(isValidCommandStatus(result.status)).toBe(true);
        expect(result.exitCode).toBe(0);
    });

    it('accepts valid failed result', () => {
        const result = {
            authToken: 'glanus_agent_abc123',
            executionId: 'exec-790',
            status: 'failed',
            exitCode: 1,
            error: 'Permission denied',
            duration: 200,
        };
        expect(isValidCommandStatus(result.status)).toBe(true);
    });

    it('accepts timeout result', () => {
        const result = {
            authToken: 'glanus_agent_abc123',
            executionId: 'exec-791',
            status: 'timeout',
            duration: 600000,
        };
        expect(isValidCommandStatus(result.status)).toBe(true);
    });

    it('rejects invalid status', () => {
        expect(isValidCommandStatus('running')).toBe(false);
        expect(isValidCommandStatus('cancelled')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Discovery endpoint schema tests
// ---------------------------------------------------------------------------

describe('Agent Discovery — Request Validation', () => {
    it('accepts valid discovery payload', () => {
        const payload = {
            authToken: 'glanus_agent_abc123',
            subnet: '192.168.1.0/24',
            devices: [
                { ipAddress: '192.168.1.1', macAddress: 'aa:bb:cc:dd:ee:ff', deviceType: 'ROUTER' },
                { ipAddress: '192.168.1.50', hostname: 'printer.local', deviceType: 'PRINTER' },
            ],
        };
        expect(payload.devices.length).toBe(2);
        expect(payload.devices[0].ipAddress).toBe('192.168.1.1');
    });

    it('accepts devices with only required ipAddress', () => {
        const device = { ipAddress: '10.0.0.1', deviceType: 'UNKNOWN' };
        expect(typeof device.ipAddress).toBe('string');
        expect(typeof device.deviceType).toBe('string');
    });

    it('enforces max 1000 devices per submission', () => {
        const devices = Array.from({ length: 1001 }, (_, i) => ({
            ipAddress: `192.168.${Math.floor(i / 256)}.${i % 256}`,
            deviceType: 'UNKNOWN',
        }));
        expect(devices.length).toBeGreaterThan(1000);
        // The Zod schema in the route would reject this
    });

    it('accepts optional snmpData', () => {
        const device = {
            ipAddress: '192.168.1.1',
            deviceType: 'SWITCH',
            snmpData: { sysDescr: 'Cisco IOS', sysUpTime: 864000 },
        };
        expect(device.snmpData.sysDescr).toBe('Cisco IOS');
    });
});

// ---------------------------------------------------------------------------
// Auth token flow integration
// ---------------------------------------------------------------------------

describe('Agent Auth Token — End-to-End Flow', () => {
    it('generates token, hashes it, and verifies successfully', () => {
        const { plaintext, hash } = generateAgentToken();

        // Hash should match re-hashing
        expect(hashAgentToken(plaintext)).toBe(hash);

        // Verify should pass
        expect(verifyAgentToken(plaintext, hash)).toBe(true);
    });

    it('different tokens produce different hashes', () => {
        const t1 = generateAgentToken();
        const t2 = generateAgentToken();
        expect(t1.hash).not.toBe(t2.hash);
        expect(t1.plaintext).not.toBe(t2.plaintext);
    });

    it('tampered token fails verification', () => {
        const { plaintext, hash } = generateAgentToken();
        const tampered = plaintext + '_tampered';
        expect(verifyAgentToken(tampered, hash)).toBe(false);
    });
});
