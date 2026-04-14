import { z } from 'zod';

/**
 * Base asset schema - shared validation rules
 */
const baseAssetSchema = z.object({
    assetType: z.enum(['PHYSICAL', 'DIGITAL', 'DYNAMIC']).default('DIGITAL'),
    name: z.string().min(1, 'Name is required').max(255),
    categoryId: z.string().min(1, 'Category ID is required'),
    manufacturer: z.string().max(255).optional(),
    model: z.string().max(255).optional(),
    serialNumber: z.string().max(255).optional(),

    // Transform empty strings to undefined for optional date fields
    purchaseDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
    purchaseCost: z.coerce.number().positive().optional(),
    warrantyUntil: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),

    location: z.string().max(255).optional(),
    status: z.enum(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'LOST']).optional(),
    description: z.string().max(5000, 'Description is too long').optional(),
    tags: z.array(z.string()).optional(),

    // Dynamic field payloads
    customFields: z.record(z.string(), z.any()).optional(),

    // Phase 26: Physical Asset specific fields
    physicalAsset: z.object({
        category: z.enum(['LAPTOP', 'DESKTOP', 'SERVER', 'MOBILE_DEVICE', 'TABLET', 'PRINTER', 'NETWORK_EQUIPMENT', 'MONITOR', 'PERIPHERAL', 'OTHER']).optional(),
        processor: z.string().max(255).optional(),
        ram: z.number().int().positive().optional(),
        storage: z.number().int().positive().optional(),
        osVersion: z.string().max(255).optional(),
        macAddress: z.string().max(255).optional(),
        ipAddress: z.string().max(255).optional(),
        isManaged: z.boolean().optional(),
    }).optional(),

    // Phase 26: Digital Asset specific fields
    digitalAsset: z.object({
        category: z.enum(['WEB_APPLICATION', 'MOBILE_APP', 'DESKTOP_APP', 'SAAS_SUBSCRIPTION', 'DATABASE', 'DEVELOPMENT_TOOL', 'SECURITY_DIGITAL', 'LICENSE', 'API_SERVICE', 'CLOUD_STORAGE', 'VIRTUAL_MACHINE', 'LLM', 'OTHER']).optional(),
        version: z.string().max(255).optional(),
        vendor: z.string().max(255).optional(),
        licenseKey: z.string().optional(),
        licenseType: z.enum(['PERPETUAL', 'SUBSCRIPTION', 'TRIAL', 'OPEN_SOURCE', 'FREEMIUM', 'ENTERPRISE']).optional(),
        seatCount: z.number().int().positive().optional(),
        seatsUsed: z.number().int().nonnegative().optional(),
        subscriptionTier: z.string().max(255).optional(),
        monthlyRecurringCost: z.number().nonnegative().optional(),
        renewalDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
        autoRenew: z.boolean().optional(),
        host: z.string().max(255).optional(),
        hostType: z.enum(['ASSET', 'PROVIDER', 'HYBRID', 'ON_PREMISE']).optional(),
        url: z.string().url('Invalid URL format').optional().or(z.literal('').transform(() => undefined)),
        connectionString: z.string().optional(),
        databaseSize: z.number().int().nonnegative().optional(),
    }).optional()
});

/**
 * Create asset request schema
 */
export const createAssetSchema = baseAssetSchema.extend({
    workspaceId: z.string().min(1, 'Workspace ID is required'),
    assignedToId: z.string().uuid().optional(),
});

/**
 * Update asset request schema (all fields optional)
 */
export const updateAssetSchema = baseAssetSchema.partial();

/**
 * Asset query parameters schema
 */
export const assetQuerySchema = z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    categoryId: z.string().optional(),
    status: z.string().optional(),
    assetType: z.string().optional(),
    location: z.string().optional(),
    assignedTo: z.string().optional(),
    assignedToId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(20),
    sortBy: z.enum(['name', 'createdAt', 'category', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Assign asset request schema
 */
export const assignAssetSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    startDate: z
        .string()
        .datetime({ message: 'startDate must be a valid ISO 8601 datetime' })
        .optional(),
    notes: z.string().max(1000).optional(),
});

/**
 * Bulk operations schemas
 */
export const bulkAssignSchema = z.object({
    assetIds: z.array(z.string().min(1)).min(1, 'At least one asset ID is required'),
    userId: z.string().min(1, 'User ID is required'),
});

export const bulkDeleteSchema = z.object({
    assetIds: z.array(z.string().min(1)).min(1, 'At least one asset ID is required'),
});

export const bulkOpsSchema = z.object({
    operation: z.enum(['DELETE', 'UPDATE', 'ASSIGN'], { message: 'operation must be DELETE, UPDATE, or ASSIGN' }),
    assetIds: z.array(z.string().min(1)).min(1, 'At least one asset ID is required'),
    data: z.object({
        status: z.enum(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'LOST']).optional(),
        location: z.string().max(255).optional(),
        assigneeId: z.string().min(1).optional(),
    }).optional(),
});

/**
 * Infer TypeScript types from schemas
 */
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type AssetQueryParams = z.infer<typeof assetQuerySchema>;
export type AssignAssetInput = z.infer<typeof assignAssetSchema>;
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
