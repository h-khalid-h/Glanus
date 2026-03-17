import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { Prisma, $Enums } from '@prisma/client';

/**
 * AssetBulkService — Handles all bulk and batch operations on assets.
 *
 * Responsibilities:
 *  - bulkDelete: soft-delete multiple assets with audit trail
 *  - bulkUpdate: batch status/location update
 *  - bulkAssign: batch assignment with history records
 *  - bulkAction: unified bulk dispatcher (update_status, delete, assign, unassign)
 *  - importCSV: CSV ingestion with batched deduplication and audit
 */
export class AssetBulkService {
    /**
     * Bulk soft-deletes assets scoped to the user's workspaces, with audit trail.
     */
    static async bulkDelete(assetIds: string[], userId: string, userEmail: string) {
        const result = await prisma.asset.updateMany({
            where: {
                id: { in: assetIds },
                deletedAt: null,
                workspace: { members: { some: { userId } } },
            },
            data: { deletedAt: new Date(), status: 'RETIRED' },
        });

        await Promise.all(assetIds.map(assetId =>
            prisma.auditLog.create({
                data: {
                    action: 'DELETE',
                    resourceType: 'Asset',
                    resourceId: assetId,
                    userId,
                    metadata: { message: 'Asset bulk deleted', deletedBy: userEmail },
                },
            })
        ));

        return { deletedCount: result.count, message: `Successfully deleted ${result.count} asset(s)` };
    }

    /**
     * Bulk updates asset status and/or location, with workspace-scoped access validation.
     */
    static async bulkUpdate(assetIds: string[], userId: string, data: { status?: string; location?: string }) {
        const assets = await prisma.asset.findMany({
            where: { id: { in: assetIds }, workspace: { members: { some: { userId } } } },
        });
        if (assets.length !== assetIds.length) {
            throw new ApiError(404, 'One or more assets not found or access denied');
        }

        const updateData: { status?: string; location?: string } = {};
        if (data.status) updateData.status = data.status;
        if (data.location) updateData.location = data.location;

        const result = await prisma.asset.updateMany({
            where: { id: { in: assetIds } },
            data: updateData as Parameters<typeof prisma.asset.updateMany>[0]['data'],
        });

        return { count: result.count, message: `${result.count} asset(s) updated successfully` };
    }

    /**
     * Bulk assigns assets to a user. Creates assignment history records atomically.
     */
    static async bulkAssign(assetIds: string[], assigneeId: string, userId: string) {
        const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
        if (!assignee) {
            throw new ApiError(404, 'Assignee not found');
        }

        const assets = await prisma.asset.findMany({
            where: { id: { in: assetIds }, deletedAt: null, workspace: { members: { some: { userId } } } },
        });
        if (assets.length !== assetIds.length) {
            throw new ApiError(400, 'One or more assets not found or access denied');
        }

        await prisma.$transaction(async (tx) => {
            await tx.asset.updateMany({ where: { id: { in: assetIds } }, data: { status: 'ASSIGNED' } });
            await tx.assignmentHistory.createMany({
                data: assetIds.map((assetId) => ({ assetId, userId: assigneeId, assignedAt: new Date() })),
            });
        });

        await Promise.all(assetIds.map(assetId =>
            prisma.auditLog.create({
                data: {
                    action: 'UPDATE',
                    resourceType: 'Asset',
                    resourceId: assetId,
                    userId,
                    metadata: {
                        message: `Asset bulk assigned to ${assignee.name}`,
                        assigneeId,
                        assigneeName: assignee.name,
                        assigneeEmail: assignee.email,
                    },
                },
            })
        ));

        return { assignedCount: assetIds.length, message: `Successfully assigned ${assetIds.length} asset(s) to ${assignee.name}` };
    }

    /**
     * Unified bulk action dispatcher: update_status, delete, assign, unassign.
     */
    static async bulkAction(
        workspaceId: string,
        userId: string,
        action: 'update_status' | 'delete' | 'assign' | 'unassign',
        assetIds: string[],
        payload?: { status?: string; assignedToId?: string }
    ) {
        const { AssetStatus } = await import('@prisma/client');
        const validStatuses = Object.values(AssetStatus) as string[];

        const assets = await prisma.asset.findMany({
            where: { id: { in: assetIds }, workspaceId },
            select: { id: true, name: true },
        });

        if (assets.length === 0) {
            throw new ApiError(400, 'No matching assets found in this workspace.');
        }

        const validIds = assets.map((a) => a.id);
        const skipped = assetIds.length - validIds.length;
        let affected = 0;

        switch (action) {
            case 'update_status': {
                if (!payload?.status) throw new ApiError(400, 'status is required for update_status action.');
                if (!validStatuses.includes(payload.status)) {
                    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
                }
                const result = await prisma.asset.updateMany({
                    where: { id: { in: validIds } },
                    data: { status: payload.status as $Enums.AssetStatus },
                });
                affected = result.count;
                break;
            }
            case 'delete': {
                const result = await prisma.asset.deleteMany({ where: { id: { in: validIds } } });
                affected = result.count;
                break;
            }
            case 'assign': {
                if (!payload?.assignedToId) throw new ApiError(400, 'assignedToId is required for assign action.');
                const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId: payload.assignedToId } });
                if (!member) throw new ApiError(400, 'Target user is not a member of this workspace.');
                const result = await prisma.asset.updateMany({ where: { id: { in: validIds } }, data: { assignedToId: payload.assignedToId } });
                affected = result.count;
                break;
            }
            case 'unassign': {
                const result = await prisma.asset.updateMany({ where: { id: { in: validIds } }, data: { assignedToId: null } });
                affected = result.count;
                break;
            }
        }

        await prisma.auditLog.create({
            data: {
                workspaceId, userId, action: `asset.bulk_${action}`,
                resourceType: 'asset', resourceId: 'bulk',
                details: {
                    action, requestedCount: assetIds.length, affectedCount: affected, skippedCount: skipped,
                    assetNames: assets.slice(0, 10).map((a) => a.name),
                    ...(payload || {}),
                } as Record<string, unknown>,
            },
        });

        return { action, affected, skipped, total: assetIds.length };
    }

    /**
     * CSV import with batched deduplication, validation, and audit trail.
     */
    static async importCSV(
        workspaceId: string,
        userId: string,
        fileName: string,
        csvText: string
    ) {
        const { AssetStatus, AssetType } = await import('@prisma/client');
        const validStatuses = Object.values(AssetStatus) as string[];
        const validTypes = Object.values(AssetType) as string[];

        const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new ApiError(400, 'CSV must have a header row and at least one data row.');

        const header = AssetBulkService._parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
        const nameIdx = header.indexOf('name');
        if (nameIdx === -1) throw new ApiError(400, 'CSV must have a "name" column.');

        const typeIdx = header.indexOf('assettype');
        const statusIdx = header.indexOf('status');
        const mfgIdx = header.indexOf('manufacturer');
        const modelIdx = header.indexOf('model');
        const serialIdx = header.indexOf('serialnumber');
        const locationIdx = header.indexOf('location');
        const categoryIdx = header.indexOf('categoryname');

        const categories = await prisma.assetCategory.findMany({ select: { id: true, name: true } });
        const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

        const existingSerials = new Set<string>();
        if (serialIdx !== -1) {
            const serials = await prisma.asset.findMany({ where: { workspaceId }, select: { serialNumber: true } });
            serials.forEach((a) => { if (a.serialNumber) existingSerials.add(a.serialNumber); });
        }

        const imported: { name: string; id: string }[] = [];
        const skipped: { row: number; name: string; reason: string }[] = [];
        const errors: { row: number; error: string }[] = [];

        const dataLines = lines.slice(1);
        const batchSize = 50;

        for (let batch = 0; batch < dataLines.length; batch += batchSize) {
            const chunk = dataLines.slice(batch, batch + batchSize);
            const createOps: Promise<void>[] = [];

            for (let i = 0; i < chunk.length; i++) {
                const rowNum = batch + i + 2;
                const fields = AssetBulkService._parseCSVLine(chunk[i]);

                const name = fields[nameIdx]?.trim();
                if (!name) { errors.push({ row: rowNum, error: 'Missing name' }); continue; }

                const rawType = typeIdx !== -1 ? fields[typeIdx]?.trim().toUpperCase() : 'PHYSICAL';
                const assetType = validTypes.includes(rawType) ? (rawType as $Enums.AssetType) : AssetType.PHYSICAL;

                const rawStatus = statusIdx !== -1 ? fields[statusIdx]?.trim().toUpperCase() : 'AVAILABLE';
                const status = validStatuses.includes(rawStatus) ? (rawStatus as $Enums.AssetStatus) : AssetStatus.AVAILABLE;

                const manufacturer = mfgIdx !== -1 ? fields[mfgIdx]?.trim() || null : null;
                const model = modelIdx !== -1 ? fields[modelIdx]?.trim() || null : null;
                const serialNumber = serialIdx !== -1 ? fields[serialIdx]?.trim() || null : null;
                const location = locationIdx !== -1 ? fields[locationIdx]?.trim() || null : null;

                if (serialNumber && existingSerials.has(serialNumber)) {
                    skipped.push({ row: rowNum, name, reason: `Duplicate serial: ${serialNumber}` });
                    continue;
                }

                let categoryId: string | undefined;
                if (categoryIdx !== -1) {
                    const catName = fields[categoryIdx]?.trim().toLowerCase();
                    if (catName && categoryMap.has(catName)) categoryId = categoryMap.get(catName);
                }

                if (serialNumber) existingSerials.add(serialNumber);

                createOps.push(
                    prisma.asset.create({
                        data: { name, assetType, status, manufacturer, model, serialNumber, location, workspaceId, ...(categoryId ? { categoryId } : {}) },
                    }).then((asset) => { imported.push({ name: asset.name, id: asset.id }); })
                        .catch((err) => { errors.push({ row: rowNum, error: err instanceof Error ? err.message : 'Unknown error' }); })
                );
            }

            await Promise.all(createOps);
        }

        await prisma.auditLog.create({
            data: {
                workspaceId, userId, action: 'asset.csv_import', resourceType: 'asset', resourceId: 'bulk_import',
                details: { fileName, totalRows: dataLines.length, imported: imported.length, skipped: skipped.length, errors: errors.length } as Prisma.InputJsonObject,
            },
        });

        return {
            imported: imported.length, skipped: skipped.length, errors: errors.length,
            details: { imported: imported.slice(0, 20), skipped: skipped.slice(0, 20), errors: errors.slice(0, 20) },
        };
    }

    /** RFC 4180-compliant CSV line parser */
    static _parseCSVLine(line: string): string[] {
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
                    else { inQuotes = false; }
                } else { current += ch; }
            } else {
                if (ch === '"') { inQuotes = true; }
                else if (ch === ',') { fields.push(current); current = ''; }
                else { current += ch; }
            }
        }
        fields.push(current);
        return fields;
    }
}
