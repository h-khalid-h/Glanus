import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const fieldTypeEnum = z.enum([
    'STRING',
    'TEXT',
    'NUMBER',
    'DECIMAL',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'TIME',
    'JSON',
    'ARRAY',
    'SELECT',
    'MULTI_SELECT',
    'ASSET_REF',
    'USER_REF',
    'FILE',
    'IMAGE',
    'VIDEO',
    'URL',
    'EMAIL',
    'PHONE',
    'IP_ADDRESS',
    'MAC_ADDRESS',
    'COLOR',
    'CURRENCY',
]);

export const actionTypeEnum = z.enum([
    'POWER',
    'NETWORK',
    'MAINTENANCE',
    'MONITORING',
    'DATA',
    'SECURITY',
    'CUSTOM',
]);

export const handlerTypeEnum = z.enum([
    'API',
    'SCRIPT',
    'WEBHOOK',
    'REMOTE_COMMAND',
    'MANUAL',
]);

export const executionStatusEnum = z.enum([
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'TIMEOUT',
]);

export const relationshipTypeEnum = z.enum([
    'CONTAINS',
    'PART_OF',
    'INSTALLED_ON',
    'HOSTED_ON',
    'DEPENDS_ON',
    'LOCATED_IN',
    'CONNECTED_TO',
    'LICENSED_TO',
    'COMPONENT_OF',
    'DEPLOYED_ON',
    'MANAGED_BY',
    'CUSTOM',
]);

// ============================================
// ASSET CATEGORY SCHEMAS
// ============================================

export const createCategorySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    slug: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
        .optional(),
    description: z.string().max(5000, 'Description is too long').optional(),
    icon: z.string().default('📦'),
    parentId: z.string().cuid().optional(),
    assetTypeValue: z.enum(['PHYSICAL', 'DIGITAL']),
    allowsChildren: z.boolean().default(true),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    metadata: z.record(z.unknown()).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryQuerySchema = z.object({
    assetType: z.enum(['PHYSICAL', 'DIGITAL']).optional(),
    parentId: z.string().cuid().optional(),
    isActive: z.boolean().optional(),
    includeFields: z.boolean().default(false),
    includeActions: z.boolean().default(false),
    includeChildren: z.boolean().default(false),
});

// ============================================
// FIELD DEFINITION SCHEMAS
// ============================================

export const createFieldDefinitionSchema = z.object({
    name: z.string().min(1).max(255),
    label: z.string().min(1).max(255),
    slug: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[a-z0-9_]+$/, 'Slug must be lowercase alphanumeric with underscores'),
    description: z.string().max(5000, 'Description is too long').optional(),
    fieldType: fieldTypeEnum,
    categoryId: z.string().cuid(),
    isRequired: z.boolean().default(false),
    isUnique: z.boolean().default(false),
    isInherited: z.boolean().default(false),
    defaultValue: z.string().optional(),
    validationRules: z
        .object({
            min: z.number().optional(),
            max: z.number().optional(),
            pattern: z.string().optional(),
            options: z.array(z.string()).optional(),
            refCategory: z.string().optional(),
        })
        .optional(),
    sortOrder: z.number().int().default(0),
    isVisible: z.boolean().default(true),
    isSearchable: z.boolean().default(false),
    group: z.string().optional(),
    placeholder: z.string().optional(),
    helpText: z.string().optional(),
});

// Schema for creating field via POST request (categoryId comes from URL)
export const createFieldDefinitionRequestSchema = createFieldDefinitionSchema.omit({ categoryId: true });

export const updateFieldDefinitionSchema = createFieldDefinitionSchema
    .omit({ categoryId: true })
    .partial();

// ============================================
// ACTION DEFINITION SCHEMAS
// ============================================

export const createActionDefinitionSchema = z.object({
    name: z.string().min(1).max(255),
    label: z.string().min(1).max(255),
    slug: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    description: z.string().max(5000, 'Description is too long').optional(),
    icon: z.string().optional(),
    categoryId: z.string().cuid(),
    actionType: actionTypeEnum,
    isDestructive: z.boolean().default(false),
    requiresConfirmation: z.boolean().default(false),
    estimatedDuration: z.number().int().positive().optional(),
    handlerType: handlerTypeEnum,
    handlerConfig: z.record(z.unknown()).optional(),
    parameters: z
        .object({
            fields: z
                .array(
                    z.object({
                        name: z.string(),
                        label: z.string(),
                        type: z.string(),
                        required: z.boolean().optional(),
                        default: z.unknown().optional(),
                        options: z.array(z.string()).optional(),
                    })
                )
                .optional(),
        })
        .optional(),
    sortOrder: z.number().int().default(0),
    isVisible: z.boolean().default(true),
    buttonColor: z.string().optional(),
});

// Schema for creating action via POST request (categoryId comes from URL)
export const createActionDefinitionRequestSchema = createActionDefinitionSchema.omit({ categoryId: true });

export const updateActionDefinitionSchema = createActionDefinitionSchema
    .omit({ categoryId: true })
    .partial();

// ============================================
// ACTION EXECUTION SCHEMAS
// ============================================

export const executeActionSchema = z.object({
    parameters: z.record(z.unknown()).optional(),
    confirm: z.boolean().optional(),
});

export const actionExecutionQuerySchema = z.object({
    assetId: z.string().cuid().optional(),
    actionDefinitionId: z.string().cuid().optional(),
    status: executionStatusEnum.optional(),
    startedAfter: z.string().datetime().optional(),
    startedBefore: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// ASSET RELATIONSHIP SCHEMAS
// ============================================

export const createRelationshipSchema = z
    .object({
        parentAssetId: z.string().cuid('Invalid parent asset ID'),
        childAssetId: z.string().cuid('Invalid child asset ID'),
        relationshipType: relationshipTypeEnum,
        quantity: z.number().int().positive().optional(),
        position: z.coerce.number().int().optional(),
        metadata: z.record(z.unknown()).optional(),
    })
    .refine((data) => data.parentAssetId !== data.childAssetId, {
        message: 'Cannot create relationship between asset and itself',
    });

export const updateRelationshipSchema = z.object({
    relationshipType: relationshipTypeEnum.optional(),
    quantity: z.number().int().positive().optional(),
    position: z.coerce.number().int().optional(),
    metadata: z.record(z.unknown()).optional(),
});

export const relationshipQuerySchema = z.object({
    assetId: z.string().cuid().optional(),
    relationshipType: relationshipTypeEnum.optional(),
    direction: z.enum(['parent', 'child', 'both']).default('both'),
    depth: z.coerce.number().int().min(1).max(10).default(1),
});

// ============================================
// DYNAMIC ASSET SCHEMAS
// ============================================

export const createDynamicAssetSchema = z.object({
    categoryId: z.string().cuid('Category is required'),
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().max(5000, 'Description is too long').optional(),
    status: z.enum(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'LOST']).optional(),
    assignedToId: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
    fields: z.record(z.unknown()), // Dynamic fields - validated separately based on category
});

export const updateDynamicAssetSchema = createDynamicAssetSchema.partial();

// Helper type exports
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateFieldDefinitionInput = z.infer<typeof createFieldDefinitionSchema>;
export type CreateActionDefinitionInput = z.infer<typeof createActionDefinitionSchema>;
export type ExecuteActionInput = z.infer<typeof executeActionSchema>;
export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
export type CreateDynamicAssetInput = z.infer<typeof createDynamicAssetSchema>;
