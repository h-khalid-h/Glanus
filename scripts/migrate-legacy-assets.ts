import { PrismaClient } from '@prisma/client';
import { DynamicFieldService, FieldType } from '../lib/services/DynamicFieldService';

const prisma = new PrismaClient();

interface MigrationStats {
    physicalAssets: { migrated: number; errors: number };
    digitalAssets: { migrated: number; errors: number };
    totalFieldValues: number;
}

async function main() {
    console.log('🚀 Starting legacy asset migration...\n');

    const stats: MigrationStats = {
        physicalAssets: { migrated: 0, errors: 0 },
        digitalAssets: { migrated: 0, errors: 0 },
        totalFieldValues: 0,
    };

    try {
        // Step 1: Create migration categories
        console.log('📦 Step 1: Creating migration categories...');
        const { physicalCategory, digitalCategory } = await createMigrationCategories();
        console.log(`✅ Created categories: ${physicalCategory.name}, ${digitalCategory.name}\n`);

        // Step 2: Create field definitions
        console.log('📝 Step 2: Creating field definitions...');
        const { physicalFields, digitalFields } = await createFieldDefinitions(
            physicalCategory.id,
            digitalCategory.id
        );
        console.log(`✅ Created ${physicalFields.length} physical fields, ${digitalFields.length} digital fields\n`);

        // Step 3: Migrate PhysicalAssets
        console.log('🔄 Step 3: Migrating PhysicalAssets...');
        const physicalStats = await migratePhysicalAssets(physicalCategory.id, physicalFields);
        stats.physicalAssets = physicalStats;
        stats.totalFieldValues += physicalStats.migrated * 6; // 6 fields per asset
        console.log(`✅ Migrated ${physicalStats.migrated} physical assets (${physicalStats.errors} errors)\n`);

        // Step 4: Migrate DigitalAssets
        console.log('🔄 Step 4: Migrating DigitalAssets...');
        const digitalStats = await migrateDigitalAssets(digitalCategory.id, digitalFields);
        stats.digitalAssets = digitalStats;
        stats.totalFieldValues += digitalStats.migrated * 5; // 5 fields per asset
        console.log(`✅ Migrated ${digitalStats.migrated} digital assets (${digitalStats.errors} errors)\n`);

        // Step 5: Validation
        console.log('✔️  Step 5: Validating migration...');
        const validation = await validateMigration();
        console.log(`✅ Validated ${validation.validated} assets (${validation.mismatches} mismatches)\n`);

        // Print summary
        printSummary(stats);

        if (validation.mismatches > 0) {
            console.log('\n⚠️  WARNING: Data mismatches detected. Review before proceeding.');
            process.exit(1);
        }

        console.log('\n🎉 Migration completed successfully!');
    } catch (error: unknown) {
        console.error('\n❌ Migration failed:', error instanceof Error ? error.message : error);
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

async function createMigrationCategories() {
    // Create or get physical category
    const physicalCategory = await prisma.assetCategory.upsert({
        where: {
            slug: 'legacy-physical',
        },
        update: {},
        create: {
            name: 'Legacy Physical Assets',
            slug: 'legacy-physical',
            description: 'Migrated from PhysicalAsset table',
            assetTypeValue: 'PHYSICAL',
            icon: '📦',
            sortOrder: 100,
        },
    });

    // Create or get digital category
    const digitalCategory = await prisma.assetCategory.upsert({
        where: {
            slug: 'legacy-digital',
        },
        update: {},
        create: {
            name: 'Legacy Digital Assets',
            slug: 'legacy-digital',
            description: 'Migrated from DigitalAsset table',
            assetTypeValue: 'DIGITAL',
            icon: '💿',
            sortOrder: 101,
        },
    });

    return { physicalCategory, digitalCategory };
}

async function createFieldDefinitions(physicalCategoryId: string, digitalCategoryId: string) {
    // Physical asset field definitions
    const physicalFieldDefs = [
        { name: 'location', label: 'Location', slug: 'location', fieldType: 'STRING' as const },
        { name: 'serialNumber', label: 'Serial Number', slug: 'serial_number', fieldType: 'STRING' as const },
        { name: 'manufacturer', label: 'Manufacturer', slug: 'manufacturer', fieldType: 'STRING' as const },
        { name: 'model', label: 'Model', slug: 'model', fieldType: 'STRING' as const },
        { name: 'condition', label: 'Condition', slug: 'condition', fieldType: 'STRING' as const },
        { name: 'warrantyExpiry', label: 'Warranty Expiry', slug: 'warranty_expiry', fieldType: 'DATE' as const },
    ];

    const physicalFields = [];
    for (const [index, fieldDef] of physicalFieldDefs.entries()) {
        const field = await prisma.assetFieldDefinition.upsert({
            where: {
                categoryId_slug: {
                    categoryId: physicalCategoryId,
                    slug: fieldDef.slug,
                },
            },
            update: {},
            create: {
                ...fieldDef,
                categoryId: physicalCategoryId,
                sortOrder: index + 1,
            },
        });
        physicalFields.push(field);
    }

    // Digital asset field definitions
    const digitalFieldDefs = [
        { name: 'licenseKey', label: 'License Key', slug: 'license_key', fieldType: 'STRING' as const },
        { name: 'version', label: 'Version', slug: 'version', fieldType: 'STRING' as const },
        { name: 'vendor', label: 'Vendor', slug: 'vendor', fieldType: 'STRING' as const },
        { name: 'subscriptionEnd', label: 'Subscription End', slug: 'subscription_end', fieldType: 'DATE' as const },
        { name: 'maxUsers', label: 'Max Users', slug: 'max_users', fieldType: 'NUMBER' as const },
    ];

    const digitalFields = [];
    for (const [index, fieldDef] of digitalFieldDefs.entries()) {
        const field = await prisma.assetFieldDefinition.upsert({
            where: {
                categoryId_slug: {
                    categoryId: digitalCategoryId,
                    slug: fieldDef.slug,
                },
            },
            update: {},
            create: {
                ...fieldDef,
                categoryId: digitalCategoryId,
                sortOrder: index + 1,
            },
        });
        digitalFields.push(field);
    }

    return { physicalFields, digitalFields };
}

async function migratePhysicalAssets(categoryId: string, fieldDefinitions: any[]) {
    const physicalAssets: any[] = await prisma.physicalAsset.findMany({
        include: { asset: true },
    });

    let migrated = 0;
    let errors = 0;

    for (const pa of physicalAssets) {
        try {
            await prisma.$transaction(async (tx) => {
                // Update asset to link to new category
                await tx.asset.update({
                    where: { id: pa.assetId },
                    data: { categoryId },
                });

                // Create field values
                const fieldMappings: Record<string, any> = {
                    location: pa.location,
                    serialNumber: pa.serialNumber,
                    manufacturer: pa.manufacturer,
                    model: pa.model,
                    condition: pa.condition,
                    warrantyExpiry: pa.warrantyExpiry,
                };

                const fieldValuesToCreate: any[] = [];

                for (const [fieldName, value] of Object.entries(fieldMappings)) {
                    if (value !== null && value !== undefined) {
                        const fieldDef = fieldDefinitions.find((f: any) => f.name === fieldName);
                        if (!fieldDef) {
                            console.warn(`Field definition not found for ${fieldName}`);
                            continue;
                        }

                        fieldValuesToCreate.push({
                            assetId: pa.assetId,
                            fieldDefinitionId: fieldDef.id,
                            ...DynamicFieldService.serializeFieldValue(value, fieldDef.fieldType as FieldType),
                        });
                    }
                }

                if (fieldValuesToCreate.length > 0) {
                    await tx.assetFieldValue.createMany({
                        data: fieldValuesToCreate,
                    });
                }
            });

            migrated++;
        } catch (error: unknown) {
            console.error(`Failed to migrate physical asset ${pa.assetId}:`, error instanceof Error ? error.message : error);
            errors++;
        }
    }

    return { migrated, errors };
}

async function migrateDigitalAssets(categoryId: string, fieldDefinitions: any[]) {
    const digitalAssets: any[] = await prisma.digitalAsset.findMany({
        include: { asset: true },
    });

    let migrated = 0;
    let errors = 0;

    for (const da of digitalAssets) {
        try {
            await prisma.$transaction(async (tx) => {
                // Update asset to link to new category
                await tx.asset.update({
                    where: { id: da.assetId },
                    data: { categoryId },
                });

                // Create field values
                const fieldMappings: Record<string, any> = {
                    licenseKey: da.licenseKey,
                    version: da.version,
                    vendor: da.vendor,
                    subscriptionEnd: da.subscriptionEnd,
                    maxUsers: da.maxUsers,
                };

                const fieldValuesToCreate: any[] = [];

                for (const [fieldName, value] of Object.entries(fieldMappings)) {
                    if (value !== null && value !== undefined) {
                        const fieldDef = fieldDefinitions.find((f: any) => f.name === fieldName);
                        if (!fieldDef) {
                            console.warn(`Field definition not found for ${fieldName}`);
                            continue;
                        }

                        fieldValuesToCreate.push({
                            assetId: da.assetId,
                            fieldDefinitionId: fieldDef.id,
                            ...DynamicFieldService.serializeFieldValue(value, fieldDef.fieldType as FieldType),
                        });
                    }
                }

                if (fieldValuesToCreate.length > 0) {
                    await tx.assetFieldValue.createMany({
                        data: fieldValuesToCreate,
                    });
                }
            });

            migrated++;
        } catch (error: unknown) {
            console.error(`Failed to migrate digital asset ${da.assetId}:`, error instanceof Error ? error.message : error);
            errors++;
        }
    }

    return { migrated, errors };
}

async function validateMigration() {
    let validated = 0;
    let mismatches = 0;

    // Validate physical assets
    const physicalAssets: any[] = await prisma.physicalAsset.findMany({
        include: {
            asset: {
                include: {
                    fieldValues: {
                        include: { fieldDefinition: true },
                    },
                },
            },
        },
    });

    for (const pa of physicalAssets) {
        const fieldValues = pa.asset.fieldValues;

        // Check each field
        const checks = [
            { name: 'location', value: pa.location },
            { name: 'serialNumber', value: pa.serialNumber },
            { name: 'manufacturer', value: pa.manufacturer },
            { name: 'model', value: pa.model },
            { name: 'condition', value: pa.condition },
            { name: 'warrantyExpiry', value: pa.warrantyExpiry?.toISOString() },
        ];

        for (const check of checks) {
            if (check.value) {
                const fv = fieldValues.find((f: any) => f.fieldDefinition.name === check.name);
                if (!fv || fv.value !== check.value) {
                    console.error(`Mismatch in ${check.name} for asset ${pa.assetId}`);
                    mismatches++;
                }
            }
        }

        validated++;
    }

    // Validate digital assets
    const digitalAssets: any[] = await prisma.digitalAsset.findMany({
        include: {
            asset: {
                include: {
                    fieldValues: {
                        include: { fieldDefinition: true },
                    },
                },
            },
        },
    });

    for (const da of digitalAssets) {
        const fieldValues = da.asset.fieldValues;

        const checks = [
            { name: 'licenseKey', value: da.licenseKey },
            { name: 'version', value: da.version },
            { name: 'vendor', value: da.vendor },
            { name: 'subscriptionEnd', value: da.subscriptionEnd?.toISOString() },
            { name: 'maxUsers', value: da.maxUsers?.toString() },
        ];

        for (const check of checks) {
            if (check.value) {
                const fv = fieldValues.find((f: any) => f.fieldDefinition.name === check.name);
                if (!fv || fv.value !== check.value) {
                    console.error(`Mismatch in ${check.name} for asset ${da.assetId}`);
                    mismatches++;
                }
            }
        }

        validated++;
    }

    return { validated, mismatches };
}

function printSummary(stats: MigrationStats) {
    console.log('================================================================================');
    console.log('📊 MIGRATION SUMMARY');
    console.log('================================================================================');
    console.log(`Physical Assets: ${stats.physicalAssets.migrated} migrated, ${stats.physicalAssets.errors} errors`);
    console.log(`Digital Assets:  ${stats.digitalAssets.migrated} migrated, ${stats.digitalAssets.errors} errors`);
    console.log(`Total Assets:    ${stats.physicalAssets.migrated + stats.digitalAssets.migrated}`);
    console.log(`Total Field Values: ~${stats.totalFieldValues}`);
    console.log('================================================================================');
}

main();
