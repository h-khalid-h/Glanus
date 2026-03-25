import { ApiError } from '@/lib/errors';
/**
 * AssetAnalyticsService — Asset telemetry, schema, and data export.
 *
 * Responsibilities:
 *  - getMetrics: fetch agent metric time-series for an asset (1h/24h/7d/30d ranges)
 *  - getSchema: resolve dynamic fields (with inheritance) + action definitions for an asset's category
 *  - exportAssets: generate a CSV export of all non-deleted assets in a workspace
 *
 * Note: asset CRUD lives in AssetService; bulk operations in AssetBulkService.
 */
import { prisma } from '@/lib/db';
import { DynamicFieldService } from '@/lib/services/DynamicFieldService';

export class AssetAnalyticsService {
    /**
     * Fetch agent metric history for an asset over the specified time range.
     * Validates workspace membership via the userId parameter.
     */
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
            where: { id: assetId, deletedAt: null, workspace: { members: { some: { userId } } } },
        });
        if (!asset) throw new ApiError(404, 'Asset not found or access denied');

        const metrics = await prisma.agentMetric.findMany({
            where: { assetId, timestamp: { gte: startTime } },
            orderBy: { timestamp: 'asc' },
        });

        return { metrics, timeRange, count: metrics.length };
    }

    /**
     * Resolve the full dynamic field schema (with category inheritance) and action definitions
     * for an asset. Returns the asset, category, fields with current values, and available actions.
     */
    static async getSchema(assetId: string) {
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, deletedAt: null },
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

        if (!asset) throw new ApiError(404, 'Asset not found');
        if (!asset.categoryId) throw new ApiError(400, 'Asset does not have a dynamic category assigned');

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

    /**
     * Generate a CSV string of all non-deleted assets in a workspace
     * with key metadata columns.
     */
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

        /** Escape a value for safe CSV embedding. */
        const esc = (v: string | number | null | undefined): string => {
            const s = String(v ?? '');
            return `"${s.replace(/"/g, '""')}"`;
        };

        const rows = assets.map((asset) => [
            esc(asset.id), esc(asset.name), esc(asset.category?.name || ''), esc(asset.manufacturer || ''),
            esc(asset.model || ''), esc(asset.serialNumber || ''), esc(asset.status), esc(asset.location || ''),
            esc(asset.assignedTo?.name || ''), esc(asset.assignedTo?.email || ''),
            esc(asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : ''),
            esc(asset.purchaseCost?.toString() || ''),
            esc(asset.warrantyUntil ? new Date(asset.warrantyUntil).toISOString().split('T')[0] : ''),
            esc(Array.isArray(asset.tags) ? asset.tags.join('; ') : ''),
            esc(asset.description || ''),
            esc(new Date(asset.createdAt).toISOString()),
        ].join(','));

        return [headers.join(','), ...rows].join('\n');
    }
}
