import { ApiError } from '@/lib/errors';
/**
 * AssetService — CMDB asset lifecycle management for workspace inventories.
 *
 * Responsibilities:
 *  - createAsset: create a new CMDB asset with dynamic field values and QR code generation
 *  - updateAsset: patch an existing asset's core fields and dynamic field values
 *  - deleteAsset: soft-remove an asset from the workspace inventory
 *  - getAsset / listAssets: workspace-scoped asset queries with filtering and pagination
 *  - bulkCreateAssets: CSV / batch ingestion with dynamic field mapping
 */
import { prisma } from '@/lib/db';
import { withCurrentRLSSession as withRLS } from '@/lib/rls-session';
import { Prisma, AssetType, AssetStatus, HardwareCategory, SoftwareCategory, LicenseType, HostType } from '@prisma/client';
import { generateAssetQRCode } from '@/lib/generateQRCode';
import { logError } from '@/lib/logger';
import { enforceQuota } from '@/lib/workspace/quotas';
import { auditLog } from '@/lib/workspace/auditLog';
import { z } from 'zod';
import { createAssetSchema, assetQuerySchema, updateAssetSchema } from '@/lib/schemas/asset.schemas';
import { DynamicFieldService, FieldType } from '@/lib/services/DynamicFieldService';

/**
 * AssetService — Core asset CRUD and lifecycle management.
 *
 * Responsibilities:
 *  - getAssets: paginated, filtered list of workspace assets
 *  - createAsset: validate, enforce quotas, persist asset + polymorphic sub-entities + dynamic fields
 *  - getAssetById: fetch full asset detail with QR code
 *  - updateAsset: update asset + polymorphic sub-entities + dynamic field values
 *  - deleteAsset: soft-delete with audit trail
 *
 * Extracted to sibling services:
 *  - AssetActionService   → listActions / getActionBySlug / executeAction
 *  - AssetAnalyticsService → getMetrics / getSchema / exportAssets
 *  - AssetBulkService     → bulkDelete / bulkUpdate / bulkAssign / bulkAction / importCSV
 *  - AssetRelationshipService → relationship CRUD
 *  - AssetAssignmentService   → assign / unassign / script execution
 */
export class AssetService {
    /**
     * Fetch a paginated, filtered list of assets for a workspace.
     */
    static async getAssets(
        workspaceId: string,
        params: Partial<z.infer<typeof assetQuerySchema>>
    ) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', search, category, status, assignedToId, assetType, location } = params;
        const skip = (page - 1) * limit;

        // Build where clause with Prisma's generated type for compile-time safety
        const where: Prisma.AssetWhereInput = {
            workspaceId,
            deletedAt: null,
        };

        if (assetType) where.assetType = assetType as AssetType;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { manufacturer: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { serialNumber: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (category) where.category = { name: { equals: category, mode: 'insensitive' } };
        if (params.categoryId) where.categoryId = params.categoryId;
        if (status) where.status = status as AssetStatus;
        if (assignedToId) where.assignedToId = assignedToId;
        if (location) where.location = { contains: location, mode: 'insensitive' };

        const [total, assets] = await Promise.all([
            prisma.asset.count({ where }),
            prisma.asset.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder } as Record<string, 'asc' | 'desc'>,
                include: {
                    physicalAsset: true,
                    digitalAsset: true,
                    assignedTo: { select: { id: true, name: true, email: true } },
                },
            }),
        ]);

        return {
            assets,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Create a new polymorphic asset (Physical/Digital) with dynamic custom fields.
     */
    static async createAsset(
        workspaceId: string,
        userId: string,
        data: z.infer<typeof createAssetSchema>
    ) {
        // Enforce Quota Constraints limit
        await enforceQuota(workspaceId, 'assets');

        return await withRLS(async (tx) => {
            if (data.serialNumber) {
                const existing = await tx.asset.findFirst({
                    where: { serialNumber: data.serialNumber, workspaceId, deletedAt: null },
                });
                if (existing) throw new ApiError(409, 'An asset with this serial number already exists in this workspace');
            }

            const selectedCategory = await tx.assetCategory.findUnique({
                where: { id: data.categoryId },
                include: { fieldDefinitions: true }
            });

            if (!selectedCategory) throw new ApiError(404, 'The specified Asset Category does not exist.');

            // Gather all field definitions from the full category chain (parent + child)
            let allFieldDefinitions = [...selectedCategory.fieldDefinitions];
            if (selectedCategory.parentId) {
                const parentCategory = await tx.assetCategory.findUnique({
                    where: { id: selectedCategory.parentId },
                    include: { fieldDefinitions: true }
                });
                if (parentCategory) {
                    allFieldDefinitions = [...parentCategory.fieldDefinitions, ...allFieldDefinitions];
                }
            } else {
                const childCategories = await tx.assetCategory.findMany({
                    where: { parentId: selectedCategory.id, isActive: true },
                    include: { fieldDefinitions: true }
                });
                for (const child of childCategories) {
                    allFieldDefinitions.push(...child.fieldDefinitions);
                }
            }

        // Build Payload
        const fieldValuesPayload = [];
        if (data.customFields && Object.keys(data.customFields).length > 0) {
            for (const def of allFieldDefinitions) {
                const incomingValue = data.customFields[def.name];

                // 1. Enforce rigorous Architectural validation
                const validationCheck = await DynamicFieldService.validateFieldValue(
                    incomingValue,
                    {
                        fieldType: def.fieldType as FieldType,
                        isRequired: def.isRequired,
                        isUnique: def.isUnique,
                        validationRules: typeof def.validationRules === 'object' ? def.validationRules as Record<string, unknown> : null,
                    }
                );

                if (!validationCheck.valid) {
                    throw new ApiError(400, `Validation failed for '${def.label}': ${validationCheck.error}`);
                }

                // 2. If valid and present, serialize for Prisma
                if (incomingValue !== undefined && incomingValue !== null && incomingValue !== '') {
                    fieldValuesPayload.push({
                        fieldDefinitionId: def.id,
                        ...DynamicFieldService.serializeFieldValue(incomingValue, def.fieldType as FieldType)
                    });
                }
            }
        } else {
            const missingRequired = allFieldDefinitions.filter((def) => def.isRequired);
            if (missingRequired.length > 0) {
                throw new ApiError(400, `Missing required custom field: ${missingRequired[0].label}`);
            }
        }

        const asset = await tx.asset.create({
            data: {
                workspaceId,
                assetType: ((data.assetType === 'DYNAMIC' ? 'DIGITAL' : data.assetType) || 'PHYSICAL') as AssetType,
                name: data.name,
                categoryId: data.categoryId,
                manufacturer: data.manufacturer || null,
                model: data.model || null,
                serialNumber: data.serialNumber || null,
                status: (data.status || 'AVAILABLE') as AssetStatus,
                purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
                purchaseCost: data.purchaseCost ? parseFloat(String(data.purchaseCost)) : null,
                warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil) : null,
                location: data.location || null,
                description: data.description || null,
                assignedToId: data.assignedToId || null,
                tags: data.tags || [],
                qrCode: null,
                ...(data.assetType === 'PHYSICAL' && data.physicalAsset ? {
                    physicalAsset: {
                        create: {
                            category: (data.physicalAsset.category || 'OTHER') as HardwareCategory,
                            processor: data.physicalAsset.processor,
                            ram: data.physicalAsset.ram,
                            storage: data.physicalAsset.storage,
                            osVersion: data.physicalAsset.osVersion,
                            macAddress: data.physicalAsset.macAddress,
                            ipAddress: data.physicalAsset.ipAddress,
                            isManaged: data.physicalAsset.isManaged || false
                        }
                    }
                } : {}),
                ...(data.assetType === 'DIGITAL' && data.digitalAsset ? {
                    digitalAsset: {
                        create: {
                            category: (data.digitalAsset.category || 'OTHER') as SoftwareCategory,
                            version: data.digitalAsset.version,
                            vendor: data.digitalAsset.vendor,
                            licenseKey: data.digitalAsset.licenseKey,
                            licenseType: data.digitalAsset.licenseType as LicenseType,
                            seatCount: data.digitalAsset.seatCount,
                            seatsUsed: data.digitalAsset.seatsUsed || 0,
                            subscriptionTier: data.digitalAsset.subscriptionTier,
                            monthlyRecurringCost: data.digitalAsset.monthlyRecurringCost,
                            renewalDate: data.digitalAsset.renewalDate ? new Date(data.digitalAsset.renewalDate) : null,
                            autoRenew: data.digitalAsset.autoRenew || false,
                            host: data.digitalAsset.host,
                            hostType: data.digitalAsset.hostType as HostType,
                            url: data.digitalAsset.url,
                            connectionString: data.digitalAsset.connectionString,
                            databaseSize: data.digitalAsset.databaseSize
                        }
                    }
                } : {}),
                fieldValues: {
                    create: fieldValuesPayload
                }
            },
            include: {
                category: true,
                physicalAsset: true,
                digitalAsset: true,
                fieldValues: {
                    include: {
                        fieldDefinition: true
                    }
                },
                assignedTo: { select: { id: true, name: true, email: true } },
            },
        });

            // Async QR Code Generation and Subsystem Side Effects
            try {
                const qrCode = await generateAssetQRCode(asset.id, asset.name);
                await tx.asset.update({ where: { id: asset.id }, data: { qrCode } });
                asset.qrCode = qrCode;
            } catch (qrError) {
                logError('QR code generation failed', qrError, { assetId: asset.id });
            }

            await auditLog({
                workspaceId,
                userId,
                action: 'asset.created',
                resourceType: 'Asset',
                resourceId: asset.id,
                details: { assetType: asset.assetType, name: asset.name, category: selectedCategory.name },
            });

            return asset;
        });
    }

    /**
     * Fetch a specific Asset by ID, verifying workspace access.
     */
    static async getAssetById(assetId: string, userId: string) {
        // Single query: fetch asset with includes AND workspace membership check
        const asset = await prisma.asset.findFirst({
            where: {
                id: assetId,
                deletedAt: null,
                workspace: { members: { some: { userId } } },
            },
            include: {
                category: {
                    include: { fieldDefinitions: true },
                },
                fieldValues: {
                    include: {
                        fieldDefinition: true,
                    },
                },
                physicalAsset: true,
                digitalAsset: true,
                assignedTo: {
                    select: { id: true, name: true, email: true, role: true },
                },
                assignmentHistory: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                    orderBy: { assignedAt: 'desc' },
                },
                remoteSessions: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                    orderBy: { startedAt: 'desc' },
                    take: 10,
                },
                aiInsights: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                auditLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
                tickets: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                agentConnection: true,
            },
        });

        if (!asset) {
            throw new ApiError(404, 'Asset not found');
        }

        return asset;
    }

    /**
     * Update an asset and its polymorphic/custom fields.
     */
    static async updateAsset(
        assetId: string,
        userId: string,
        data: z.infer<typeof updateAssetSchema>
    ) {
        // Verify workspace membership and get current state first to obtain workspaceId
        const existingAsset = await prisma.asset.findFirst({
            where: {
                id: assetId,
                deletedAt: null,
                workspace: {
                    members: { some: { userId } },
                },
            },
            include: {
                category: {
                    include: { fieldDefinitions: true }
                },
                fieldValues: true
            }
        });

        if (!existingAsset) {
            throw new ApiError(404, 'Asset not found');
        }

        return await withRLS(async (tx) => {
            // Re-fetch locally inside the transaction if needed, or just use existingAsset.
            // But existingAsset is already secure since we verified membership above.

        if (data.serialNumber && data.serialNumber !== existingAsset?.serialNumber) {
            const duplicate = await tx.asset.findFirst({
                where: {
                    serialNumber: data.serialNumber,
                    workspaceId: existingAsset.workspaceId,
                    id: { not: assetId },
                },
            });
            if (duplicate) {
                throw new ApiError(409, 'An asset with this serial number already exists');
            }
        }

        if (data.customFields && existingAsset.category) {
            // Gather all field definitions from the full category chain
            let allFieldDefs = [...existingAsset.category.fieldDefinitions];
            if (existingAsset.category.parentId) {
                const parentCat = await tx.assetCategory.findUnique({
                    where: { id: existingAsset.category.parentId },
                    include: { fieldDefinitions: true }
                });
                if (parentCat) {
                    allFieldDefs = [...parentCat.fieldDefinitions, ...allFieldDefs];
                }
            } else {
                const childCats = await tx.assetCategory.findMany({
                    where: { parentId: existingAsset.category.id, isActive: true },
                    include: { fieldDefinitions: true }
                });
                for (const child of childCats) {
                    allFieldDefs.push(...child.fieldDefinitions);
                }
            }

            for (const def of allFieldDefs) {
                const incomingValue = data.customFields[def.name];
                const existingValueRecord = existingAsset.fieldValues.find((fv) => fv.fieldDefinitionId === def.id);

                if (incomingValue !== undefined) {
                    if (incomingValue === '' || incomingValue === null) {
                        if (def.isRequired) {
                            throw new ApiError(400, `Missing required custom field: ${def.label}`);
                        }
                        if (existingValueRecord) {
                            await tx.assetFieldValue.delete({ where: { id: existingValueRecord.id } });
                        }
                    } else {
                        // 1. Enforce rigorous Architectural validation
                        const validationCheck = await DynamicFieldService.validateFieldValue(
                            incomingValue,
                            {
                                fieldType: def.fieldType as FieldType,
                                isRequired: def.isRequired,
                                isUnique: def.isUnique,
                                validationRules: typeof def.validationRules === 'object' ? def.validationRules as Record<string, unknown> : null,
                            },
                            assetId // Pass the assetId to exclude current record from uniqueness checks
                        );

                        if (!validationCheck.valid) {
                            throw new ApiError(400, `Validation failed for '${def.label}': ${validationCheck.error}`);
                        }

                        // 2. Serialize for Prisma
                        const mappedData = DynamicFieldService.serializeFieldValue(incomingValue, def.fieldType as FieldType);

                        if (existingValueRecord) {
                            await tx.assetFieldValue.update({
                                where: { id: existingValueRecord.id },
                                data: mappedData
                            });
                        } else {
                            await tx.assetFieldValue.create({
                                data: {
                                    assetId,
                                    fieldDefinitionId: def.id,
                                    ...mappedData
                                }
                            });
                        }
                    }
                }
            }
        }

        const asset = await tx.asset.update({
            where: { id: assetId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
                ...(data.manufacturer !== undefined && { manufacturer: data.manufacturer }),
                ...(data.model !== undefined && { model: data.model }),
                ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber }),
                ...(data.status !== undefined && { status: data.status as AssetStatus }),
                ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null }),
                ...(data.purchaseCost !== undefined && { purchaseCost: data.purchaseCost ? parseFloat(String(data.purchaseCost)) : null }),
                ...(data.warrantyUntil !== undefined && { warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil) : null }),
                ...(data.location !== undefined && { location: data.location }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.tags !== undefined && { tags: data.tags }),

                ...(data.assetType === 'PHYSICAL' && data.physicalAsset ? {
                    physicalAsset: {
                        upsert: {
                            create: {
                                category: (data.physicalAsset.category || 'OTHER') as HardwareCategory,
                                processor: data.physicalAsset.processor,
                                ram: data.physicalAsset.ram,
                                storage: data.physicalAsset.storage,
                                osVersion: data.physicalAsset.osVersion,
                                macAddress: data.physicalAsset.macAddress,
                                ipAddress: data.physicalAsset.ipAddress,
                                isManaged: data.physicalAsset.isManaged || false
                            },
                            update: {
                                category: (data.physicalAsset.category || 'OTHER') as HardwareCategory,
                                processor: data.physicalAsset.processor,
                                ram: data.physicalAsset.ram,
                                storage: data.physicalAsset.storage,
                                osVersion: data.physicalAsset.osVersion,
                                macAddress: data.physicalAsset.macAddress,
                                ipAddress: data.physicalAsset.ipAddress,
                                isManaged: data.physicalAsset.isManaged || false
                            }
                        }
                    }
                } : {}),
                ...(data.assetType === 'DIGITAL' && data.digitalAsset ? {
                    digitalAsset: {
                        upsert: {
                            create: {
                                category: (data.digitalAsset.category || 'OTHER') as SoftwareCategory,
                                version: data.digitalAsset.version,
                                vendor: data.digitalAsset.vendor,
                                licenseKey: data.digitalAsset.licenseKey,
                                licenseType: data.digitalAsset.licenseType as LicenseType,
                                seatCount: data.digitalAsset.seatCount,
                                seatsUsed: data.digitalAsset.seatsUsed || 0,
                                subscriptionTier: data.digitalAsset.subscriptionTier,
                                monthlyRecurringCost: data.digitalAsset.monthlyRecurringCost,
                                renewalDate: data.digitalAsset.renewalDate ? new Date(data.digitalAsset.renewalDate) : null,
                                autoRenew: data.digitalAsset.autoRenew || false,
                                host: data.digitalAsset.host,
                                hostType: data.digitalAsset.hostType as HostType,
                                url: data.digitalAsset.url,
                                connectionString: data.digitalAsset.connectionString,
                                databaseSize: data.digitalAsset.databaseSize
                            },
                            update: {
                                category: (data.digitalAsset.category || 'OTHER') as SoftwareCategory,
                                version: data.digitalAsset.version,
                                vendor: data.digitalAsset.vendor,
                                licenseKey: data.digitalAsset.licenseKey,
                                licenseType: data.digitalAsset.licenseType as LicenseType,
                                seatCount: data.digitalAsset.seatCount,
                                seatsUsed: data.digitalAsset.seatsUsed || 0,
                                subscriptionTier: data.digitalAsset.subscriptionTier,
                                monthlyRecurringCost: data.digitalAsset.monthlyRecurringCost,
                                renewalDate: data.digitalAsset.renewalDate ? new Date(data.digitalAsset.renewalDate) : null,
                                autoRenew: data.digitalAsset.autoRenew || false,
                                host: data.digitalAsset.host,
                                hostType: data.digitalAsset.hostType as HostType,
                                url: data.digitalAsset.url,
                                connectionString: data.digitalAsset.connectionString,
                                databaseSize: data.digitalAsset.databaseSize
                            }
                        }
                    }
                } : {}),
            },
            include: {
                assignedTo: { select: { id: true, name: true, email: true } },
                physicalAsset: true,
                digitalAsset: true,
                fieldValues: {
                    include: { fieldDefinition: true }
                }
            },
        });

        await auditLog({
            workspaceId: existingAsset.workspaceId,
            userId,
            action: 'asset.updated',
            resourceType: 'Asset',
            resourceId: asset.id,
            details: { assetName: asset.name, changes: data },
        });

        return asset;
    });
}

    /**
     * Soft-delete an asset.
     */
    static async deleteAsset(assetId: string, userId: string) {
        const existingAsset = await prisma.asset.findFirst({
            where: {
                id: assetId,
                deletedAt: null,
                workspace: {
                    members: { some: { userId } },
                },
            },
        });

        if (!existingAsset) {
            throw new ApiError(404, 'Asset not found');
        }

        return await withRLS(async (tx) => {
            const asset = await tx.asset.update({
                where: { id: assetId },
                data: { deletedAt: new Date(), status: 'RETIRED' },
            });

            await auditLog({
                workspaceId: existingAsset.workspaceId,
                userId,
                action: 'asset.deleted',
                resourceType: 'Asset',
                resourceId: asset.id,
                details: { assetName: asset.name },
            });

            return asset;
        });
    }

}
