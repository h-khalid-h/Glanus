import { ApiError } from '@/lib/errors';
/**
 * MdmService — Manages Mobile Device Management (MDM) profiles for workspace endpoints.
 *
 * Responsibilities:
 *  - getProfiles: list MDM profiles with optional platform filter
 *  - createProfile: create a new MDM configuration profile
 *  - deleteProfile: remove a profile from the workspace
 *  - assignProfiles: push profiles to specific agent connections
 */
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const createMdmProfileSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    platform: z.enum(['WINDOWS', 'MACOS', 'LINUX']),
    profileType: z.string().min(1).max(100),
    configPayload: z.any(),
});

export const updateMdmProfileSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    platform: z.enum(['WINDOWS', 'MACOS', 'LINUX']).optional(),
    profileType: z.string().min(1).max(100).optional(),
    configPayload: z.any().optional(),
});

export const assignMdmProfilesSchema = z.object({
    profileId: z.string(),
    assetIds: z.array(z.string()).min(1),
});

export class MdmService {
    /**
     * Fetch all MDM Profiles for a workspace, optionally filtered by platform.
     */
    static async getProfiles(workspaceId: string, platform?: string | null) {
        return prisma.mdmProfile.findMany({
            where: {
                workspaceId,
                ...(platform ? { platform } : {})
            },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { assignments: true }
                }
            }
        });
    }

    /**
     * Create a new MDM Profile.
     */
    static async createProfile(
        workspaceId: string,
        data: z.infer<typeof createMdmProfileSchema>
    ) {
        return prisma.mdmProfile.create({
            data: {
                workspaceId,
                name: data.name,
                description: data.description,
                platform: data.platform,
                profileType: data.profileType,
                configPayload: data.configPayload,
            }
        });
    }

    /**
     * Update an existing MDM profile.
     */
    static async updateProfile(
        workspaceId: string,
        profileId: string,
        data: z.infer<typeof updateMdmProfileSchema>
    ) {
        const existing = await prisma.mdmProfile.findUnique({
            where: { id: profileId }
        });

        if (!existing || existing.workspaceId !== workspaceId) {
            throw new ApiError(404, 'MDM profile not found');
        }

        return prisma.mdmProfile.update({
            where: { id: profileId },
            data: {
                name: data.name,
                description: data.description,
                platform: data.platform,
                profileType: data.profileType,
                configPayload: data.configPayload
            }
        });
    }

    /**
     * Delete an MDM profile.
     */
    static async deleteProfile(workspaceId: string, profileId: string) {
        const existing = await prisma.mdmProfile.findUnique({
            where: { id: profileId }
        });

        if (!existing || existing.workspaceId !== workspaceId) {
            throw new ApiError(404, 'MDM profile not found');
        }

        return prisma.mdmProfile.delete({
            where: { id: profileId }
        });
    }

    /**
     * Fetch MDM Profile Assignments, optionally filtered by profile.
     */
    static async getAssignments(workspaceId: string, profileId?: string | null, page = 1, limit = 20) {
        const where = {
            profile: { workspaceId },
            ...(profileId ? { profileId } : {}),
        };

        const [assignments, total] = await Promise.all([
            prisma.mdmAssignment.findMany({
                where,
                include: {
                    asset: {
                        select: { id: true, name: true, serialNumber: true }
                    },
                    profile: {
                        select: { id: true, name: true, platform: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.mdmAssignment.count({ where }),
        ]);

        return {
            assignments,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    /**
     * Assign an MDM Profile to one or more Assets. 
     * Uses upsert to gracefully handle re-assignments.
     */
    static async assignProfiles(
        workspaceId: string,
        data: z.infer<typeof assignMdmProfilesSchema>
    ) {
        const profile = await prisma.mdmProfile.findUnique({
            where: { id: data.profileId }
        });

        if (!profile || profile.workspaceId !== workspaceId) {
            throw new ApiError(404, 'MDM profile not found');
        }

        // Validate all asset IDs belong to this workspace
        const validAssets = await prisma.asset.findMany({
            where: { id: { in: data.assetIds }, workspaceId, deletedAt: null },
            select: { id: true },
        });
        const validAssetIds = new Set(validAssets.map(a => a.id));
        const invalidIds = data.assetIds.filter(id => !validAssetIds.has(id));
        if (invalidIds.length > 0) {
            throw new ApiError(400, `Assets not found in this workspace: ${invalidIds.join(', ')}`);
        }

        return Promise.all(
            data.assetIds.map(async (assetId) => {
                return prisma.mdmAssignment.upsert({
                    where: {
                        profileId_assetId: {
                            profileId: data.profileId,
                            assetId
                        }
                    },
                    update: {
                        status: 'PENDING',
                        errorLog: null,
                    },
                    create: {
                        profileId: data.profileId,
                        assetId,
                        status: 'PENDING'
                    }
                });
            })
        );
    }
}
