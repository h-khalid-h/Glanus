/**
 * ZtnaService — Zero Trust Network Access policy management.
 *
 * Responsibilities:
 *  - listPolicies / createPolicy / updatePolicy / deletePolicy: CRUD for ZTNA access policies
 */
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { z } from 'zod';

/** Validate individual IP or CIDR notation (e.g., "10.0.0.1" or "192.168.1.0/24") */
function isValidIpOrCidr(entry: string): boolean {
    const cidrMatch = entry.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/);
    if (!cidrMatch) return false;
    const octets = cidrMatch[1].split('.').map(Number);
    if (octets.some(o => o < 0 || o > 255)) return false;
    if (cidrMatch[2] !== undefined) {
        const prefix = Number(cidrMatch[2]);
        if (prefix < 0 || prefix > 32) return false;
    }
    return true;
}

const ipWhitelistValidator = z.string().min(3).max(1000).refine((val) => {
    const entries = val.split(',').map(e => e.trim()).filter(Boolean);
    return entries.length > 0 && entries.every(isValidIpOrCidr);
}, 'Each entry must be a valid IPv4 address or CIDR (e.g., "10.0.0.1" or "192.168.1.0/24")');

export const createZtnaSchema = z.object({
    isEnabled: z.boolean().default(false),
    ipWhitelist: ipWhitelistValidator,
    action: z.string().default('BLOCK'),
});

export const updateZtnaSchema = z.object({
    isEnabled: z.boolean().optional(),
    ipWhitelist: ipWhitelistValidator.optional(),
    action: z.string().optional(),
});

/**
 * ZtnaService — Zero-Trust Network Access policy management.
 *
 * Methods:
 *   - listPolicies(workspaceId)
 *   - createPolicy(workspaceId, data) — enforces 1-policy-per-workspace limit
 *   - updatePolicy(workspaceId, policyId, data)
 *   - deletePolicy(workspaceId, policyId)
 */
export class ZtnaService {

    static async listPolicies(workspaceId: string) {
        return prisma.ztnaPolicy.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
        });
    }

    static async createPolicy(workspaceId: string, data: { isEnabled: boolean; ipWhitelist: string; action: string }) {
        const existingCount = await prisma.ztnaPolicy.count({ where: { workspaceId } });
        if (existingCount > 0) {
            throw new ApiError(400, 'Only one ZTNA policy object is supported per Workspace. Please update the existing policy instead.');
        }

        return prisma.ztnaPolicy.create({
            data: { workspaceId, isEnabled: data.isEnabled, ipWhitelist: data.ipWhitelist, action: data.action },
        });
    }

    static async updatePolicy(workspaceId: string, policyId: string, data: { isEnabled?: boolean; ipWhitelist?: string; action?: string }) {
        const policy = await prisma.ztnaPolicy.findUnique({ where: { id: policyId, workspaceId } });
        if (!policy) throw new ApiError(404, 'Zero-Trust Network Policy not found');

        return prisma.ztnaPolicy.update({ where: { id: policyId }, data });
    }

    static async deletePolicy(workspaceId: string, policyId: string) {
        const policy = await prisma.ztnaPolicy.findUnique({ where: { id: policyId, workspaceId } });
        if (!policy) throw new ApiError(404, 'Zero-Trust Network Policy not found');

        await prisma.ztnaPolicy.delete({ where: { id: policyId } });
        return null;
    }
}
