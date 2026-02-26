import { z } from 'zod';

/**
 * Base asset schema - shared validation rules
 */
const baseAssetSchema = z.object({
    assetType: z.enum(['PHYSICAL', 'DIGITAL']).default('PHYSICAL'),
    name: z.string().min(1, 'Name is required').max(255),
    category: z.enum([
        // Physical asset categories (HardwareCategory)
        'LAPTOP',
        'DESKTOP',
        'SERVER',
        'MOBILE_DEVICE',
        'TABLET',
        'PRINTER',
        'NETWORK_EQUIPMENT',
        'MONITOR',
        'PERIPHERAL',
        // Digital asset categories (SoftwareCategory)
        'WEB_APPLICATION',
        'MOBILE_APP',
        'DESKTOP_APP',
        'SAAS_SUBSCRIPTION',
        'DATABASE',
        'DEVELOPMENT_TOOL',
        'SECURITY_DIGITAL',
        'LICENSE',
        'API_SERVICE',
        'CLOUD_STORAGE',
        'VIRTUAL_MACHINE',
        'LLM',
        // Shared
        'OTHER',
    ]),
    manufacturer: z.string().max(255).optional(),
    model: z.string().max(255).optional(),
    serialNumber: z.string().max(255).optional(),

    // Transform empty strings to undefined for optional date fields
    purchaseDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
    purchaseCost: z.number().positive().optional().or(z.string().transform((val) => val === '' || val === '0' ? undefined : parseFloat(val))),
    warrantyUntil: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),

    location: z.string().max(255).optional(),
    status: z.enum(['AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'RETIRED', 'LOST']).optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),

    // Physical asset fields 
    processor: z.string().optional(),
    ram: z.union([z.number(), z.string()]).optional(),
    storage: z.union([z.number(), z.string()]).optional(),
    osVersion: z.string().optional(),
    macAddress: z.string().optional(),
    ipAddress: z.string().optional(),

    // Digital asset fields
    vendor: z.string().optional(),
    version: z.string().optional(),
    licenseKey: z.string().optional(),
    licenseType: z.string().optional(),
    seatCount: z.union([z.number(), z.string()]).optional(),
    seatsUsed: z.union([z.number(), z.string()]).optional(),
    subscriptionTier: z.string().optional(),
    monthlyRecurringCost: z.union([z.number(), z.string()]).optional(),
    renewalDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
    autoRenew: z.boolean().optional(),
    host: z.string().optional(),
    hostType: z.string().optional(),
    url: z.string().optional(),
    sslExpiry: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
    connectionString: z.string().optional(),
    databaseSize: z.union([z.number(), z.string()]).optional(),
    installedOn: z.array(z.string()).optional(),
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
    status: z.string().optional(),
    assetType: z.string().optional(),
    location: z.string().optional(),
    assignedTo: z.string().optional(),
    assignedToId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.enum(['name', 'createdAt', 'category', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Assign asset request schema
 */
export const assignAssetSchema = z.object({
    userId: z.string().uuid('Invalid user ID format'),
    notes: z.string().max(1000).optional(),
});

/**
 * Bulk operations schemas
 */
export const bulkAssignSchema = z.object({
    assetIds: z.array(z.string().uuid()).min(1, 'At least one asset ID is required'),
    userId: z.string().uuid('Invalid user ID format'),
});

export const bulkDeleteSchema = z.object({
    assetIds: z.array(z.string().uuid()).min(1, 'At least one asset ID is required'),
});

export const bulkOpsSchema = z.object({
    operation: z.enum(['DELETE', 'UPDATE', 'ASSIGN'], { message: 'operation must be DELETE, UPDATE, or ASSIGN' }),
    assetIds: z.array(z.string().uuid()).min(1, 'At least one asset ID is required'),
    data: z.object({
        status: z.enum(['AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'RETIRED', 'LOST']).optional(),
        location: z.string().max(255).optional(),
        assigneeId: z.string().uuid().optional(),
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
