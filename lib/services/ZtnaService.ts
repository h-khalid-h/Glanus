import { ApiError } from '@/lib/errors';
/**
 * ZtnaService — Zero Trust Network Access policy management.
 *
 * Responsibilities:
 *  - listPolicies / createPolicy / updatePolicy / deletePolicy: CRUD for ZTNA access policies
 *
 * NOTE: `(prisma as any).ztnaPolicy` casts throughout this service are required because
 * the `ZtnaPolicy` model is referenced but not yet present in the canonical Prisma schema.
 * TODO: Add `ZtnaPolicy` to `prisma/schema.prisma` and run `prisma generate` to remove these casts.
 */
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const createZtnaSchema = z.object({
    isEnabled: z.boolean().default(false),
    ipWhitelist: z.string().min(3).max(1000),
    action: z.string().default('BLOCK'),
});

export const updateZtnaSchema = z.object({
    isEnabled: z.boolean().optional(),
    ipWhitelist: z.string().min(3).max(1000).optional(),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (prisma as any).ztnaPolicy.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
        });
    }

    static async createPolicy(workspaceId: string, data: { isEnabled: boolean; ipWhitelist: string; action: string }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingCount = await (prisma as any).ztnaPolicy.count({ where: { workspaceId } });
        if (existingCount > 0) {
            throw new ApiError(400, 'Only one ZTNA policy object is supported per Workspace. Please update the existing policy instead.');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (prisma as any).ztnaPolicy.create({
            data: { workspaceId, isEnabled: data.isEnabled, ipWhitelist: data.ipWhitelist, action: data.action },
        });
    }

    static async updatePolicy(workspaceId: string, policyId: string, data: { isEnabled?: boolean; ipWhitelist?: string; action?: string }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const policy = await (prisma as any).ztnaPolicy.findUnique({ where: { id: policyId, workspaceId } });
        if (!policy) throw new ApiError(404, 'Zero-Trust Network Policy not found');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (prisma as any).ztnaPolicy.update({ where: { id: policyId }, data });
    }

    static async deletePolicy(workspaceId: string, policyId: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const policy = await (prisma as any).ztnaPolicy.findUnique({ where: { id: policyId, workspaceId } });
        if (!policy) throw new ApiError(404, 'Zero-Trust Network Policy not found');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).ztnaPolicy.delete({ where: { id: policyId } });
        return null; // 204 No Content
    }
}
