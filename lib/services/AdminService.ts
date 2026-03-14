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
            await prisma.agentVersion.updateMany({
                where: { platform: data.platform, status: 'ACTIVE' },
                data: { status: 'DEPRECATED' },
            });
        }

        return prisma.agentVersion.upsert({
            where: { version_platform: { version: data.version, platform: data.platform } },
            update: data,
            create: data,
        });
    }
}
