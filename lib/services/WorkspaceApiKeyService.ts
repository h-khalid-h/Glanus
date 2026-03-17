import { ApiError } from '@/lib/errors';
/**
 * WorkspaceApiKeyService — Manages programmatic API access keys for workspace automation.
 *
 * Responsibilities:
 *  - createApiKey: generate a scoped API key (one-time plaintext display), store hashed
 *  - listApiKeys: return all keys for a workspace (never the plaintext)
 *  - revokeApiKey: delete a key, logging the revocation in the audit trail
 *  - validateApiKey: verify a bearer token from inbound API requests
 */
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export interface CreateApiKeyInput {
    name: string;
    scopes: Array<'read' | 'write' | 'admin' | 'agents' | 'scripts'>;
    expiresIn?: 'never' | '30d' | '90d' | '1y';
}

/**
 * WorkspaceApiKeyService — API key lifecycle management for a workspace.
 *
 * Responsibilities:
 *  - listApiKeys: return all keys (never returns plaintext)
 *  - createApiKey: generate a secure key; returns raw key ONCE, stores SHA-256 hash as `keyHash`
 *  - revokeApiKey: soft-delete by setting revokedAt + audit log
 */
export class WorkspaceApiKeyService {
    static async listApiKeys(workspaceId: string) {
        return prisma.apiKey.findMany({
            where: { workspaceId },
            select: {
                id: true, name: true, prefix: true, scopes: true,
                lastUsedAt: true, usageCount: true, expiresAt: true,
                revokedAt: true, createdBy: true, createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    static async createApiKey(workspaceId: string, userId: string, data: CreateApiKeyInput) {
        const rawKey = `glns_${crypto.randomBytes(32).toString('hex')}`;
        const prefix = rawKey.slice(0, 13); // "glns_" + 8 hex chars
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        let expiresAt: Date | null = null;
        if (data.expiresIn && data.expiresIn !== 'never') {
            expiresAt = new Date();
            const map: Record<string, () => void> = {
                '30d': () => expiresAt!.setDate(expiresAt!.getDate() + 30),
                '90d': () => expiresAt!.setDate(expiresAt!.getDate() + 90),
                '1y': () => expiresAt!.setFullYear(expiresAt!.getFullYear() + 1),
            };
            map[data.expiresIn]?.();
        }

        const apiKey = await prisma.apiKey.create({
            data: { workspaceId, name: data.name, prefix, keyHash, scopes: data.scopes, expiresAt, createdBy: userId },
            select: { id: true, name: true, prefix: true, scopes: true, expiresAt: true, createdAt: true },
        });

        await prisma.auditLog.create({
            data: {
                workspaceId, userId,
                action: 'api_key.created',
                resourceType: 'api_key',
                resourceId: apiKey.id,
                details: { name: data.name, scopes: data.scopes, expiresIn: data.expiresIn || 'never' },
            },
        });

        return { ...apiKey, rawKey };
    }

    static async revokeApiKey(workspaceId: string, keyId: string, userId: string) {
        const existing = await prisma.apiKey.findUnique({ where: { id: keyId, workspaceId } });
        if (!existing) throw new ApiError(404, 'API key not found');
        if (existing.revokedAt) throw new ApiError(400, 'Key is already revoked');

        await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });

        await prisma.auditLog.create({
            data: {
                workspaceId, userId,
                action: 'api_key.revoked',
                resourceType: 'api_key',
                resourceId: keyId,
                details: { name: existing.name },
            },
        });
    }
}
