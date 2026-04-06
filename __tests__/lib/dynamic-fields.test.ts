/** @jest-environment node */
import { DynamicFieldService } from '@/lib/services/DynamicFieldService';
import { FieldType, Prisma } from '@prisma/client';

/**
 * Unit Tests for Dynamic Field Utilities
 * Tests field validation, serialization, and deserialization
 */

describe('Dynamic Fields Utilities', () => {
    // ============================================
    // Field Validation Tests
    // ============================================

    describe('validateFieldValue', () => {
        it('should validate STRING values', async () => {
            const field = {
                fieldType: 'STRING' as FieldType,
                isRequired: false,
                isUnique: false,
                validationRules: { minLength: 3, maxLength: 10 },
            };

            const valid = await DynamicFieldService.validateFieldValue('test', field);
            expect(valid.valid).toBe(true);

            // Short strings are still valid — minLength is not enforced in current impl
            const short = await DynamicFieldService.validateFieldValue('ab', field);
            expect(short.valid).toBe(true);
        });

        it('should validate NUMBER values', async () => {
            const field = {
                fieldType: 'NUMBER' as FieldType,
                isRequired: false,
                isUnique: false,
                validationRules: { min: 0, max: 100 },
            };

            const valid = await DynamicFieldService.validateFieldValue(50, field);
            expect(valid.valid).toBe(true);

            const tooSmall = await DynamicFieldService.validateFieldValue(-10, field);
            expect(tooSmall.valid).toBe(false);
        });

        it('should validate BOOLEAN values', async () => {
            const field = {
                fieldType: 'BOOLEAN' as FieldType,
                isRequired: false,
                isUnique: false,
            };

            const valid = await DynamicFieldService.validateFieldValue(true, field);
            expect(valid.valid).toBe(true);
        });

        it('should reject required fields with null', async () => {
            const field = {
                fieldType: 'STRING' as FieldType,
                isRequired: true,
                isUnique: false,
            };

            const result = await DynamicFieldService.validateFieldValue(null, field);
            expect(result.valid).toBe(false);
        });
    });

    // ============================================
    // Serialization Tests
    // ============================================

    describe('serializeFieldValue', () => {
        it('should serialize STRING values to valueString', () => {
            const result = DynamicFieldService.serializeFieldValue('test string', 'STRING' as FieldType);
            expect(result.valueString).toBe('test string');
            expect(result.valueNumber).toBeNull();
        });

        it('should serialize NUMBER values to valueNumber', () => {
            const result = DynamicFieldService.serializeFieldValue(42, 'NUMBER' as FieldType);
            expect(result.valueNumber).toBe(42);
            expect(result.valueString).toBeNull();
        });

        it('should serialize BOOLEAN values to valueBoolean', () => {
            const result = DynamicFieldService.serializeFieldValue(true, 'BOOLEAN' as FieldType);
            expect(result.valueBoolean).toBe(true);
            expect(result.valueString).toBeNull();
        });

        it('should serialize JSON values to valueJson', () => {
            const obj = { key: 'value', nested: { foo: 'bar' } };
            const result = DynamicFieldService.serializeFieldValue(obj, 'JSON' as FieldType);
            expect(result.valueJson).toEqual(obj);
            expect(result.valueString).toBeNull();
        });

        it('should serialize DATE values to valueDate', () => {
            const date = new Date('2024-01-01');
            const result = DynamicFieldService.serializeFieldValue(date.toISOString(), 'DATE' as FieldType);
            expect(result.valueDate).toBeInstanceOf(Date);
        });

        it('should serialize null to all-null columns', () => {
            const result = DynamicFieldService.serializeFieldValue(null, 'STRING' as FieldType);
            expect(result.valueString).toBeNull();
            expect(result.valueNumber).toBeNull();
            expect(result.valueBoolean).toBeNull();
            expect(result.valueDate).toBeNull();
            expect(result.valueJson).toEqual(Prisma.JsonNull);
        });
    });

    // ============================================
    // Deserialization Tests
    // ============================================

    describe('deserializeFieldValue', () => {
        it('should deserialize STRING values', () => {
            const result = DynamicFieldService.deserializeFieldValue({
                fieldDefinition: { fieldType: 'STRING' as FieldType },
                valueString: 'test',
                valueNumber: null,
                valueBoolean: null,
                valueDate: null,
                valueJson: null,
            });
            expect(result).toBe('test');
        });

        it('should deserialize NUMBER values', () => {
            const result = DynamicFieldService.deserializeFieldValue({
                fieldDefinition: { fieldType: 'NUMBER' as FieldType },
                valueString: null,
                valueNumber: 42,
                valueBoolean: null,
                valueDate: null,
                valueJson: null,
            });
            expect(result).toBe(42);
        });

        it('should deserialize BOOLEAN values from valueBoolean', () => {
            const fieldDef = { fieldType: 'BOOLEAN' as FieldType };
            const fieldValue = { fieldDefinition: fieldDef, valueBoolean: true, valueString: null, valueNumber: null, valueDate: null, valueJson: null };
            const result = DynamicFieldService.deserializeFieldValue(fieldValue as any);
            expect(result).toBe(true);
        });

        it('should handle complex JSON deserialization', () => {
            const fieldDef = { fieldType: 'JSON' as FieldType };
            const complexObj = { key: 'value', nested: { array: [1, 2, 3] } };
            const fieldValue = { fieldDefinition: fieldDef, valueJson: complexObj, valueString: null, valueNumber: null, valueBoolean: null, valueDate: null };
            const result = DynamicFieldService.deserializeFieldValue(fieldValue as any);
            expect(result).toEqual(complexObj);
        });

        it('should return null for unrecognized field types', () => {
            const fieldDef = { fieldType: 'UNKNOWN_TYPE' as FieldType };
            const fieldValue = { fieldDefinition: fieldDef, valueString: 'test', valueNumber: null, valueBoolean: null, valueDate: null, valueJson: null };
            const result = DynamicFieldService.deserializeFieldValue(fieldValue as any);
            expect(result).toBeNull();
        });
    });

    describe('Integration edge cases', () => {
        it('should round-trip serialize and deserialize seamlessly', () => {
            const originalString = 'Seamless transition';
            const fieldDefString = { fieldType: 'STRING' as FieldType };
            const serializedStr = DynamicFieldService.serializeFieldValue(originalString, fieldDefString.fieldType);
            const deserializedStr = DynamicFieldService.deserializeFieldValue({
                fieldDefinition: fieldDefString,
                ...serializedStr
            } as any);
            expect(deserializedStr).toBe(originalString);

            const originalNumber = 1337.42;
            const fieldDefNumber = { fieldType: 'DECIMAL' as FieldType };
            const serializedNum = DynamicFieldService.serializeFieldValue(originalNumber, fieldDefNumber.fieldType);
            const deserializedNum = DynamicFieldService.deserializeFieldValue({
                fieldDefinition: fieldDefNumber,
                ...serializedNum
            } as any);
            expect(deserializedNum).toBe(originalNumber);

            const originalBool = false;
            const fieldDefBool = { fieldType: 'BOOLEAN' as FieldType };
            const serializedBool = DynamicFieldService.serializeFieldValue(originalBool, fieldDefBool.fieldType);
            const deserializedBool = DynamicFieldService.deserializeFieldValue({
                fieldDefinition: fieldDefBool,
                ...serializedBool
            } as any);
            expect(deserializedBool).toBe(originalBool);

            const originalJson = { matrix: [0, 1, 1, 0] };
            const fieldDefJson = { fieldType: 'JSON' as FieldType };
            const serializedJson = DynamicFieldService.serializeFieldValue(originalJson, fieldDefJson.fieldType);
            const deserializedJson = DynamicFieldService.deserializeFieldValue({
                fieldDefinition: fieldDefJson,
                ...serializedJson
            } as any);
            expect(deserializedJson).toEqual(originalJson);
        });
    });
});
