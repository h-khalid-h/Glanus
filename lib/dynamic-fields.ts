// FieldType enum values matching Prisma schema
type FieldType = 'STRING' | 'TEXT' | 'NUMBER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'TIME' | 'EMAIL' | 'URL' | 'IP_ADDRESS' | 'MAC_ADDRESS' | 'SELECT' | 'MULTI_SELECT' | 'ASSET_REF' | 'USER_REF' | 'JSON' | 'ARRAY' | 'COLOR' | 'PHONE' | 'FILE' | 'IMAGE' | 'VIDEO' | 'CURRENCY' | 'PERCENTAGE' | 'DURATION' | 'UUID' | 'REGEX' | 'CODE';
import { prisma } from './db';

/**
 * Validates a field value against its definition
 */
export async function validateFieldValue(
    value: unknown,
    fieldDefinition: {
        fieldType: FieldType;
        isRequired: boolean;
        isUnique: boolean;
        validationRules?: Record<string, unknown> | null;
    },
    assetId?: string
): Promise<{ valid: boolean; error?: string }> {
    // Check required
    if (fieldDefinition.isRequired && (value === null || value === undefined || value === '')) {
        return { valid: false, error: 'Field is required' };
    }

    // Skip validation if value is empty and not required
    if (!fieldDefinition.isRequired && (value === null || value === undefined || value === '')) {
        return { valid: true };
    }

    const rules = (fieldDefinition.validationRules || {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic validation rules

    // Type-specific validation
    switch (fieldDefinition.fieldType) {
        case 'STRING':
        case 'TEXT':
            if (typeof value !== 'string') {
                return { valid: false, error: 'Value must be a string' };
            }
            if (rules.min && value.length < rules.min) {
                return { valid: false, error: `Minimum length is ${rules.min}` };
            }
            if (rules.max && value.length > rules.max) {
                return { valid: false, error: `Maximum length is ${rules.max}` };
            }
            if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
                return { valid: false, error: 'Value does not match pattern' };
            }
            break;

        case 'NUMBER':
        case 'DECIMAL':
            const num = typeof value === 'string' ? parseFloat(value) : value;
            if (typeof num !== 'number' || isNaN(num)) {
                return { valid: false, error: 'Value must be a number' };
            }
            if (rules.min !== undefined && num < rules.min) {
                return { valid: false, error: `Minimum value is ${rules.min}` };
            }
            if (rules.max !== undefined && num > rules.max) {
                return { valid: false, error: `Maximum value is ${rules.max}` };
            }
            break;

        case 'BOOLEAN':
            if (typeof value !== 'boolean') {
                return { valid: false, error: 'Value must be a boolean' };
            }
            break;

        case 'DATE':
        case 'DATETIME':
        case 'TIME':
            try {
                const date = new Date(value as string);
                if (isNaN(date.getTime())) {
                    return { valid: false, error: 'Invalid date format' };
                }
            } catch {
                return { valid: false, error: 'Invalid date' };
            }
            break;

        case 'EMAIL':
            if (typeof value !== 'string') {
                return { valid: false, error: 'Value must be a string' };
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                return { valid: false, error: 'Invalid email format' };
            }
            break;

        case 'URL':
            if (typeof value !== 'string') {
                return { valid: false, error: 'Value must be a string' };
            }
            try {
                new URL(value);
            } catch {
                return { valid: false, error: 'Invalid URL format' };
            }
            break;

        case 'IP_ADDRESS':
            if (typeof value !== 'string') {
                return { valid: false, error: 'Value must be a string' };
            }
            const ipRegex =
                /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            if (!ipRegex.test(value)) {
                return { valid: false, error: 'Invalid IP address format' };
            }
            break;

        case 'MAC_ADDRESS':
            if (typeof value !== 'string') {
                return { valid: false, error: 'Value must be a string' };
            }
            const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
            if (!macRegex.test(value)) {
                return { valid: false, error: 'Invalid MAC address format' };
            }
            break;

        case 'SELECT':
            if (!rules.options || !Array.isArray(rules.options)) {
                return { valid: false, error: 'Select field missing options' };
            }
            if (!rules.options.includes(value)) {
                return { valid: false, error: `Value must be one of: ${rules.options.join(', ')}` };
            }
            break;

        case 'MULTI_SELECT':
            if (!Array.isArray(value)) {
                return { valid: false, error: 'Value must be an array' };
            }
            if (!rules.options || !Array.isArray(rules.options)) {
                return { valid: false, error: 'Multi-select field missing options' };
            }
            for (const item of value) {
                if (!rules.options.includes(item)) {
                    return {
                        valid: false,
                        error: `Invalid option: ${item}. Must be one of: ${rules.options.join(', ')}`,
                    };
                }
            }
            break;

        case 'ASSET_REF':
            if (typeof value !== 'string') {
                return { valid: false, error: 'Asset reference must be a string (asset ID)' };
            }
            // Verify asset exists
            const asset = await prisma.asset.findUnique({
                where: { id: value as string },
                select: { id: true, categoryId: true },
            });
            if (!asset) {
                return { valid: false, error: 'Referenced asset does not exist' };
            }
            // If refCategory specified, verify asset is of that category
            if (rules.refCategory && asset.categoryId !== rules.refCategory) {
                return { valid: false, error: `Referenced asset must be of category: ${rules.refCategory}` };
            }
            break;

        case 'USER_REF':
            if (typeof value !== 'string') {
                return { valid: false, error: 'User reference must be a string (user ID)' };
            }
            const user = await prisma.user.findUnique({
                where: { id: value as string },
                select: { id: true },
            });
            if (!user) {
                return { valid: false, error: 'Referenced user does not exist' };
            }
            break;

        case 'JSON':
        case 'ARRAY':
            // Already validated by schema, just ensure it's valid JSON
            try {
                if (typeof value === 'string') {
                    JSON.parse(value);
                }
            } catch {
                return { valid: false, error: 'Invalid JSON format' };
            }
            break;
    }

    // Check uniqueness
    if (fieldDefinition.isUnique && value) {
        // Count existing field values with this value (excluding current asset if updating)
        const count = await prisma.assetFieldValue.count({
            where: {
                fieldDefinitionId: (fieldDefinition as any).id,
                ...(fieldDefinition.fieldType === 'STRING' ||
                    fieldDefinition.fieldType === 'TEXT' ||
                    fieldDefinition.fieldType === 'EMAIL' ||
                    fieldDefinition.fieldType === 'URL' ||
                    fieldDefinition.fieldType === 'IP_ADDRESS' ||
                    fieldDefinition.fieldType === 'MAC_ADDRESS'
                    ? { valueString: value as string }
                    : fieldDefinition.fieldType === 'NUMBER' || fieldDefinition.fieldType === 'DECIMAL'
                        ? { valueNumber: value as number }
                        : {}),
                ...(assetId && { assetId: { not: assetId } }),
            },
        });

        if (count > 0) {
            return { valid: false, error: 'Value must be unique' };
        }
    }

    return { valid: true };
}

/**
 * Resolve all field definitions for a category (including inherited from parents)
 */
export async function resolveInheritedFields(categoryId: string) {
    const fields: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic field definitions
    let currentCategoryId: string | null = categoryId;

    while (currentCategoryId) {
        const category: { fieldDefinitions: { id: string; fieldType: string; isRequired: boolean; isUnique: boolean; validationRules: unknown; slug: string; name: string; label: string; description: string | null; defaultValue: string | null; isInherited: boolean; sortOrder: number; categoryId: string }[]; parent: { id: string } | null } | null = await prisma.assetCategory.findUnique({
            where: { id: currentCategoryId },
            include: {
                fieldDefinitions: {
                    orderBy: { sortOrder: 'asc' },
                },
                parent: {
                    select: { id: true },
                },
            },
        });

        if (!category) break;

        // Add fields from this category (mark as inherited if not the original category)
        for (const field of category.fieldDefinitions) {
            fields.push({
                ...field,
                isInherited: currentCategoryId !== categoryId,
            });
        }

        currentCategoryId = category.parent?.id || null;
    }

    return fields;
}

/**
 * Serialize a value to the appropriate database column
 */
export function serializeFieldValue(value: unknown, fieldType: FieldType) {
    if (value === null || value === undefined) {
        return {
            valueString: null,
            valueNumber: null,
            valueBoolean: null,
            valueDate: null,
            valueJson: null,
        };
    }

    switch (fieldType) {
        case 'STRING':
        case 'TEXT':
        case 'EMAIL':
        case 'URL':
        case 'IP_ADDRESS':
        case 'MAC_ADDRESS':
        case 'COLOR':
        case 'PHONE':
        case 'SELECT':
        case 'ASSET_REF':
        case 'USER_REF':
        case 'FILE':
        case 'IMAGE':
        case 'VIDEO':
            return {
                valueString: String(value),
                valueNumber: null,
                valueBoolean: null,
                valueDate: null,
                valueJson: null,
            };

        case 'NUMBER':
        case 'DECIMAL':
        case 'CURRENCY':
            return {
                valueString: null,
                valueNumber: typeof value === 'string' ? parseFloat(value) : (value as number),
                valueBoolean: null,
                valueDate: null,
                valueJson: null,
            };

        case 'BOOLEAN':
            return {
                valueString: null,
                valueNumber: null,
                valueBoolean: Boolean(value),
                valueDate: null,
                valueJson: null,
            };

        case 'DATE':
        case 'DATETIME':
        case 'TIME':
            return {
                valueString: null,
                valueNumber: null,
                valueBoolean: null,
                valueDate: new Date(value as string),
                valueJson: null,
            };

        case 'JSON':
        case 'ARRAY':
        case 'MULTI_SELECT':
            return {
                valueString: null,
                valueNumber: null,
                valueBoolean: null,
                valueDate: null,
                valueJson: value as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma JSON
            };

        default:
            return {
                valueString: JSON.stringify(value),
                valueNumber: null,
                valueBoolean: null,
                valueDate: null,
                valueJson: null,
            };
    }
}

/**
 * Deserialize a field value from database format
 */
export function deserializeFieldValue(fieldValue: {
    fieldDefinition: { fieldType: FieldType };
    valueString: string | null;
    valueNumber: number | null;
    valueBoolean: boolean | null;
    valueDate: Date | null;
    valueJson: unknown;
}): unknown {
    const { fieldType } = fieldValue.fieldDefinition;

    switch (fieldType) {
        case 'STRING':
        case 'TEXT':
        case 'EMAIL':
        case 'URL':
        case 'IP_ADDRESS':
        case 'MAC_ADDRESS':
        case 'COLOR':
        case 'PHONE':
        case 'SELECT':
        case 'ASSET_REF':
        case 'USER_REF':
        case 'FILE':
        case 'IMAGE':
        case 'VIDEO':
            return fieldValue.valueString;

        case 'NUMBER':
        case 'DECIMAL':
        case 'CURRENCY':
            return fieldValue.valueNumber;

        case 'BOOLEAN':
            return fieldValue.valueBoolean;

        case 'DATE':
        case 'DATETIME':
        case 'TIME':
            return fieldValue.valueDate;

        case 'JSON':
        case 'ARRAY':
        case 'MULTI_SELECT':
            return fieldValue.valueJson;

        default:
            return null;
    }
}
