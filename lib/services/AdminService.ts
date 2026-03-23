/**
 * AdminService — Platform-level administration operations for super-admin users.
 *
 * Responsibilities:
 *  - getAdminStats: platform-wide usage statistics (users, workspaces, assets, agents)
 *  - createAgentVersion / listAgentVersions: manage agent binary version registry
 *  - updateAgentVersion / deleteAgentVersion: lifecycle management for agent releases
 *
 * Note: all methods require requireAdmin() at the route layer.
 */
import { prisma } from '@/lib/db';

export type AgentVersionInput = {
    version: string;
    platform: 'WINDOWS' | 'MACOS' | 'LINUX';
    downloadUrl: string;
    checksum: string;
    status: 'ACTIVE' | 'DEPRECATED' | 'BETA';
    required: boolean;
    releaseNotes?: string;
};

/**
 * AdminService — Domain layer for agent version lifecycle management.
 *
 * Encapsulates:
 *   - Agent version listing and publishing with auto-deprecation
 *
 * See also:
 *   - AssetCategoryAdminService — category/field/action schema CRUD
 *   - PartnerModerationService  — partner moderation state machine
 */
export class AdminService {

    static async listAgentVersions() {
        return prisma.agentVersion.findMany({
            orderBy: [{ platform: 'asc' }, { createdAt: 'desc' }],
        });
    }

    /**
     * Publish (or upsert) an agent version.
     * When activating a version, all other ACTIVE versions for that platform are auto-deprecated.
     */
    static async publishAgentVersion(data: AgentVersionInput) {
        if (data.status === 'ACTIVE') {
            // Deprecation + upsert must be atomic: if upsert fails, we must not leave
            // the platform with zero ACTIVE versions.
            return prisma.$transaction(async (tx) => {
                await tx.agentVersion.updateMany({
                    where: { platform: data.platform, status: 'ACTIVE' },
                    data: { status: 'DEPRECATED' },
                });
                return tx.agentVersion.upsert({
                    where: { version_platform: { version: data.version, platform: data.platform } },
                    update: data,
                    create: data,
                });
            });
        }

        return prisma.agentVersion.upsert({
            where: { version_platform: { version: data.version, platform: data.platform } },
            update: data,
            create: data,
        });
    }
}
