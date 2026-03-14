import { prisma } from '@/lib/db';
import { Prisma, AssetType, AssetStatus, HardwareCategory, SoftwareCategory, LicenseType, HostType } from '@prisma/client';
import { generateAssetQRCode } from '@/lib/generateQRCode';
import { logError } from '@/lib/logger';
import { enforceQuota } from '@/lib/workspace/quotas';
import { auditLog } from '@/lib/workspace/auditLog';
import { z } from 'zod';
import { createAssetSchema, assetQuerySchema, updateAssetSchema } from '@/lib/schemas/asset.schemas';
import { DynamicFieldService, FieldType } from '@/lib/services/DynamicFieldService';

/**
 * AssetService — Core CRUD + actions + metrics + schema + CSV export.
 *
 * Extracted responsibilities (see sibling services):
 *  - Bulk operations   → AssetBulkService
 *  - Relationships     → AssetRelationshipService
 *  - Assignment/Script → AssetAssignmentService
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

        if (data.serialNumber) {
            const existing = await prisma.asset.findFirst({
                where: { serialNumber: data.serialNumber, workspaceId },
            });
            if (existing) throw Object.assign(new Error('An asset with this serial number already exists in this workspace'), { statusCode: 409 });
        }

        const selectedCategory = await prisma.assetCategory.findUnique({
            where: { id: data.categoryId },
            include: { fieldDefinitions: true }
        });

        if (!selectedCategory) throw Object.assign(new Error('The specified Asset Category does not exist.'), { statusCode: 404 });

        // Build Payload
        const fieldValuesPayload = [];
        if (data.customFields && Object.keys(data.customFields).length > 0) {
            for (const def of selectedCategory.fieldDefinitions) {
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
                    throw Object.assign(new Error(`Validation failed for '${def.label}': ${validationCheck.error}`), { statusCode: 400 });
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
            const missingRequired = selectedCategory.fieldDefinitions.filter((def) => def.isRequired);
            if (missingRequired.length > 0) {
                throw Object.assign(new Error(`Missing required custom field: ${missingRequired[0].label}`), { statusCode: 400 });
            }
        }

        const asset = await prisma.asset.create({
            data: {
                workspaceId,
                assetType: (data.assetType || 'PHYSICAL') as AssetType,
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
            await prisma.asset.update({ where: { id: asset.id }, data: { qrCode } });
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
    }

    /**
     * Fetch a specific Asset by ID, verifying workspace access.
     */
    static async getAssetById(assetId: string, userId: string) {
        // Verify workspace membership
        const accessCheck = await prisma.asset.findFirst({
            where: {
                id: assetId,
                deletedAt: null,
                workspace: {
                    members: { some: { userId } },
                },
            },
        });

        if (!accessCheck) {
            throw Object.assign(new Error('Asset not found'), { statusCode: 404 });
        }

        const asset = await prisma.asset.findFirst({
            where: { id: assetId, deletedAt: null },
            include: {
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
            },
        });

        if (!asset) {
            throw new Error('Asset not found');
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
        // Verify workspace membership and get current state
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
            throw new Error('Asset not found');
        }

        if (data.serialNumber && data.serialNumber !== existingAsset.serialNumber) {
            const duplicate = await prisma.asset.findFirst({
                where: {
                    serialNumber: data.serialNumber,
                    workspaceId: existingAsset.workspaceId,
                    id: { not: assetId },
                },
            });
            if (duplicate) {
                throw Object.assign(new Error('An asset with this serial number already exists'), { statusCode: 409 });
            }
        }

        if (data.customFields && existingAsset.category) {
            for (const def of existingAsset.category.fieldDefinitions) {
                const incomingValue = data.customFields[def.name];
                const existingValueRecord = existingAsset.fieldValues.find((fv) => fv.fieldDefinitionId === def.id);

                if (incomingValue !== undefined) {
                    if (incomingValue === '' || incomingValue === null) {
                        if (def.isRequired) {
                            throw Object.assign(new Error(`Missing required custom field: ${def.label}`), { statusCode: 400 });
                        }
                        if (existingValueRecord) {
                            await prisma.assetFieldValue.delete({ where: { id: existingValueRecord.id } });
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
                            throw Object.assign(new Error(`Validation failed for '${def.label}': ${validationCheck.error}`), { statusCode: 400 });
                        }

                        // 2. Serialize for Prisma
                        const mappedData = DynamicFieldService.serializeFieldValue(incomingValue, def.fieldType as FieldType);

                        if (existingValueRecord) {
                            await prisma.assetFieldValue.update({
                                where: { id: existingValueRecord.id },
                                data: mappedData
                            });
                        } else {
                            await prisma.assetFieldValue.create({
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

        const asset = await prisma.asset.update({
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

        await prisma.auditLog.create({
            data: {
                action: 'ASSET_UPDATED',
                resourceType: 'Asset',
                resourceId: asset.id,
                userId,
                metadata: { assetName: asset.name, changes: data },
            },
        });

        return asset;
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
            throw Object.assign(new Error('Asset not found'), { statusCode: 404 });
        }

        const asset = await prisma.asset.update({
            where: { id: assetId },
            data: { deletedAt: new Date(), status: 'RETIRED' },
        });

        await prisma.auditLog.create({
            data: {
                action: 'ASSET_DELETED',
                resourceType: 'Asset',
                resourceId: asset.id,
                userId,
                assetId: asset.id,
                metadata: { assetName: asset.name },
            },
        });

        return asset;
    }

    // ========================================
    // ASSET ACTIONS (Category action definitions)
    // ========================================

    static async listActions(assetId: string) {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId },
            include: {
                category: {
                    include: { actionDefinitions: { orderBy: { sortOrder: 'asc' } } },
                },
            },
        });

        if (!asset) throw Object.assign(new Error('Asset not found'), { statusCode: 404 });

        if (!asset.categoryId) {
            return { assetId, assetName: asset.name, categoryId: null, categoryName: null, actions: [] };
        }

        const actions = asset.category?.actionDefinitions || [];
        return {
            assetId, assetName: asset.name, categoryId: asset.categoryId, categoryName: asset.category?.name,
            actions: actions.map((action) => ({
                id: action.id, name: action.name, label: action.label, slug: action.slug,
                description: action.description, icon: action.icon, actionType: action.actionType,
                isDestructive: action.isDestructive, requiresConfirmation: action.requiresConfirmation,
                estimatedDuration: action.estimatedDuration, buttonColor: action.buttonColor,
                parameters: action.parameters,
            })),
        };
    }

    static async getActionBySlug(assetId: string, actionSlug: string) {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId }, select: { id: true, name: true, categoryId: true },
        });
        if (!asset) throw Object.assign(new Error('Asset not found'), { statusCode: 404 });
        if (!asset.categoryId) throw Object.assign(new Error('Asset does not have a dynamic category'), { statusCode: 400 });

        const actions = await prisma.assetActionDefinition.findMany({
            where: { categoryId: asset.categoryId, isVisible: true },
            orderBy: { sortOrder: 'asc' },
            select: {
                id: true, name: true, label: true, slug: true, description: true, icon: true,
                actionType: true, isDestructive: true, requiresConfirmation: true,
                estimatedDuration: true, handlerType: true, parameters: true, buttonColor: true,
            },
        });

        const action = actions.find((a) => a.slug === actionSlug);
        if (!action) throw Object.assign(new Error('Action not found'), { statusCode: 404 });

        return { asset: { id: asset.id, name: asset.name }, action, actions };
    }

    static async executeAction(assetId: string, actionSlug: string, data: { parameters?: Record<string, unknown>; confirm?: boolean }) {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId }, select: { id: true, name: true, categoryId: true },
        });
        if (!asset) throw Object.assign(new Error('Asset not found'), { statusCode: 404 });
        if (!asset.categoryId) throw Object.assign(new Error('Asset does not have a dynamic category'), { statusCode: 400 });

        const actionDefinition = await prisma.assetActionDefinition.findFirst({
            where: { categoryId: asset.categoryId, slug: actionSlug, isVisible: true },
        });
        if (!actionDefinition) throw Object.assign(new Error('Action not found'), { statusCode: 404 });

        if (actionDefinition.isDestructive && actionDefinition.requiresConfirmation && !data.confirm) {
            throw Object.assign(new Error('Confirmation required for destructive action'), { statusCode: 400 });
        }

        const execution = await prisma.assetActionExecution.create({
            data: {
                assetId, actionDefinitionId: actionDefinition.id,
                status: 'PENDING', parameters: (data.parameters || {}) as Prisma.InputJsonValue, startedAt: new Date(),
            },
        });

        // Dispatch async — import lazily to avoid circular deps
        const { executeAction } = await import('@/lib/action-handlers');
        // executeAction arg type is a union of all action definition shapes — cast at boundary only
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        executeAction(actionDefinition as any, asset, data.parameters || {}, execution.id)
            .then(async (result) => {
                await prisma.assetActionExecution.update({
                    where: { id: execution.id },
                    data: {
                        status: result.status, result: result.output as Prisma.InputJsonValue,
                        errorMessage: result.error, completedAt: result.status === 'COMPLETED' ? new Date() : null,
                    },
                });
            })
            .catch(async (error: unknown) => {
                const message = error instanceof Error ? error.message : 'Unknown execution error';
                await prisma.assetActionExecution.update({
                    where: { id: execution.id },
                    data: { status: 'FAILED', errorMessage: message, completedAt: new Date() },
                }).catch(() => { /* best-effort */ });
            });

        return {
            execution: { id: execution.id, status: execution.status, startedAt: execution.startedAt },
            message: 'Action execution started',
            pollUrl: `/api/executions/${execution.id}`,
        };
    }

    // ========================================
    // ASSET METRICS
    // ========================================

    static async getMetrics(assetId: string, userId: string, timeRange = '24h') {
        const now = new Date();
        const startTime = new Date();
        switch (timeRange) {
            case '1h': startTime.setHours(now.getHours() - 1); break;
            case '7d': startTime.setDate(now.getDate() - 7); break;
            case '30d': startTime.setDate(now.getDate() - 30); break;
            default: startTime.setHours(now.getHours() - 24);
        }

        const asset = await prisma.asset.findFirst({
            where: { id: assetId, workspace: { members: { some: { userId } } } },
        });
        if (!asset) throw Object.assign(new Error('Asset not found or access denied'), { statusCode: 404 });

        const metrics = await prisma.agentMetric.findMany({
            where: { assetId, timestamp: { gte: startTime } },
            orderBy: { timestamp: 'asc' },
        });

        return { metrics, timeRange, count: metrics.length };
    }

    // ========================================
    // ASSET SCHEMA (Dynamic fields + actions)
    // ========================================

    static async getSchema(assetId: string) {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId },
            include: {
                category: {
                    select: {
                        id: true, name: true,
                        fieldDefinitions: { orderBy: { sortOrder: 'asc' } },
                        parent: { select: { id: true, name: true } },
                    },
                },
                fieldValues: {
                    include: {
                        fieldDefinition: { select: { name: true, label: true, slug: true, fieldType: true } },
                    },
                },
            },
        });

        if (!asset) throw Object.assign(new Error('Asset not found'), { statusCode: 404 });
        if (!asset.categoryId) throw Object.assign(new Error('Asset does not have a dynamic category assigned'), { statusCode: 400 });

        const allFields = await DynamicFieldService.resolveInheritedFields(asset.category!.id);
        const actions = await prisma.assetActionDefinition.findMany({
            where: { categoryId: asset.category!.id }, orderBy: { name: 'asc' },
        });

        const fieldValuesMap = new Map(asset.fieldValues.map(fv => [fv.fieldDefinitionId, fv]));

        const fieldsWithValues = allFields.map((field) => {
            const value = fieldValuesMap.get(field.id);
            return {
                ...field,
                currentValue: value ? {
                    id: value.id, valueString: value.valueString, valueNumber: value.valueNumber,
                    valueBoolean: value.valueBoolean, valueDate: value.valueDate, valueJson: value.valueJson,
                } : null,
            };
        });

        return { asset: { id: asset.id, name: asset.name }, category: asset.category, fields: fieldsWithValues, actions };
    }

    // ========================================
    // ASSET CSV EXPORT
    // ========================================

    static async exportAssets(workspaceId: string) {
        const assets = await prisma.asset.findMany({
            where: { workspaceId, deletedAt: null },
            include: {
                assignedTo: { select: { name: true, email: true } },
                category: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const headers = [
            'ID', 'Name', 'Category', 'Manufacturer', 'Model', 'Serial Number',
            'Status', 'Location', 'Assigned To', 'Assigned Email',
            'Purchase Date', 'Purchase Cost', 'Warranty Until', 'Tags',
            'Description', 'Created At',
        ];

        const rows = assets.map((asset) => [
            asset.id, asset.name, asset.category?.name || '', asset.manufacturer || '',
            asset.model || '', asset.serialNumber || '', asset.status, asset.location || '',
            asset.assignedTo?.name || '', asset.assignedTo?.email || '',
            asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
            asset.purchaseCost || '',
            asset.warrantyUntil ? new Date(asset.warrantyUntil).toISOString().split('T')[0] : '',
            Array.isArray(asset.tags) ? asset.tags.join('; ') : '',
            asset.description?.replace(/"/g, '""') || '',
            new Date(asset.createdAt).toISOString(),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const csvContent = [headers.join(','), ...rows.map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(','))].join('\n');
        return csvContent;
    }
}
