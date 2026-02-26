import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { generateAssetQRCode } from '@/lib/generateQRCode';
import { logError } from '@/lib/logger';
import { validateQuery, ValidationError, handleValidationError } from '@/lib/validation';
import { assetQuerySchema } from '@/lib/schemas/asset.schemas';
import { withRateLimit } from '@/lib/security/rateLimit';
import { verifyWorkspaceAccess } from '@/lib/workspace/utils';
import { enforceQuota, QuotaExceededError } from '@/lib/workspace/quotas';
import { auditLog } from '@/lib/workspace/auditLog';
import { validateRequest } from '@/lib/validation';
import { createAssetSchema } from '@/lib/schemas/asset.schemas';

// GET /api/assets - List assets with filtering and pagination
export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    const dbUser = await prisma.user.findUnique({
        where: { email: user.email! },
    });
    if (!dbUser) {
        return apiError(404, 'User not found');
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
        return apiError(400, 'Workspace ID required. Please select a workspace.');
    }

    const { hasAccess } = await verifyWorkspaceAccess(dbUser.id, workspaceId);
    if (!hasAccess) {
        return apiError(403, 'Access denied to workspace');
    }

    const params = validateQuery(searchParams, assetQuerySchema);
    const { page, limit, sortBy, sortOrder, search, category, status, assignedToId, assetType, location } = params;
    const skip = ((page ?? 1) - 1) * (limit ?? 20);

    const where: any = { // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma dynamic where
        workspaceId,
        deletedAt: null,
    };

    if (assetType) where.assetType = assetType;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { manufacturer: { contains: search, mode: 'insensitive' } },
            { model: { contains: search, mode: 'insensitive' } },
            { serialNumber: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (category) where.category = category;
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (location) where.location = { contains: location, mode: 'insensitive' };

    const total = await prisma.asset.count({ where });

    const assets = await prisma.asset.findMany({
        where,
        skip,
        take: limit ?? 20,
        orderBy: { [sortBy ?? 'createdAt']: sortOrder ?? 'desc' } as Record<string, 'asc' | 'desc'>,
        include: {
            physicalAsset: true,
            digitalAsset: true,
            assignedTo: { select: { id: true, name: true, email: true } },
        },
    });

    return apiSuccess({
        assets,
        pagination: {
            page,
            limit: limit ?? 20,
            total,
            totalPages: Math.ceil(total / (limit ?? 20)),
        },
    });
});

// POST /api/assets - Create new asset
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();

    const data = await validateRequest(request, createAssetSchema);

    // Check for duplicate serial number
    if (data.serialNumber) {
        const existing = await prisma.asset.findUnique({
            where: { serialNumber: data.serialNumber },
        });
        if (existing) {
            return apiError(409, 'An asset with this serial number already exists');
        }
    }

    const workspaceId = (data as Record<string, unknown>).workspaceId as string | undefined;
    if (workspaceId) {
        await enforceQuota(workspaceId, 'assets');
    }

    const asset = await prisma.asset.create({
        data: {
            workspaceId: workspaceId || '',
            assetType: data.assetType || 'PHYSICAL',
            name: data.name,
            manufacturer: data.manufacturer || null,
            model: data.model || null,
            serialNumber: data.serialNumber || null,
            status: (data.status || 'AVAILABLE') as any, // Prisma enum
            purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
            purchaseCost: data.purchaseCost ? parseFloat(String(data.purchaseCost)) : null,
            warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil) : null,
            location: data.location || null,
            description: data.description || null,
            assignedToId: data.assignedToId || null,
            tags: data.tags || [],
            qrCode: null,
        },
        include: {
            physicalAsset: true,
            digitalAsset: true,
            assignedTo: { select: { id: true, name: true, email: true } },
        },
    });

    // Create type-specific record (legacy support)
    if (data.assetType === 'PHYSICAL') {
        await prisma.physicalAsset.create({
            data: {
                assetId: asset.id,
                category: data.category as any, // Prisma enum
                manufacturer: data.manufacturer || null,
                model: data.model || null,
                serialNumber: data.serialNumber || null,
                processor: data.processor || null,
                ram: data.ram ? parseInt(String(data.ram)) : null,
                storage: data.storage ? parseInt(String(data.storage)) : null,
                osVersion: data.osVersion || null,
                macAddress: data.macAddress || null,
                ipAddress: data.ipAddress || null,
            },
        });
    } else if (data.assetType === 'DIGITAL') {
        await prisma.digitalAsset.create({
            data: {
                assetId: asset.id,
                category: data.category as any, // Prisma enum
                version: data.version || null,
                vendor: data.vendor || null,
                licenseKey: data.licenseKey || null,
                licenseType: data.licenseType as any || null, // Prisma enum
                seatCount: data.seatCount ? parseInt(String(data.seatCount)) : null,
                seatsUsed: data.seatsUsed ? parseInt(String(data.seatsUsed)) : 0,
                subscriptionTier: data.subscriptionTier || null,
                monthlyRecurringCost: data.monthlyRecurringCost ? parseFloat(String(data.monthlyRecurringCost)) : null,
                renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
                autoRenew: data.autoRenew || false,
                host: data.host || null,
                hostType: data.hostType as any || null, // Prisma enum
                url: data.url || null,
                sslExpiry: data.sslExpiry ? new Date(data.sslExpiry) : null,
                connectionString: data.connectionString || null,
                databaseSize: data.databaseSize ? parseInt(String(data.databaseSize)) : null,
                installedOn: data.installedOn || [],
            },
        });
    }

    // Generate QR code
    try {
        const qrCode = await generateAssetQRCode(asset.id, asset.name);
        await prisma.asset.update({
            where: { id: asset.id },
            data: { qrCode },
        });
        asset.qrCode = qrCode;
    } catch (qrError) {
        logError('QR code generation failed', qrError, { assetId: asset.id });
    }

    await prisma.auditLog.create({
        data: {
            action: 'ASSET_CREATED',
            resourceType: 'Asset',
            resourceId: asset.id,
            userId: user.id,
            assetId: asset.id,
            metadata: { assetType: asset.assetType, assetName: asset.name },
        },
    });

    const completeAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
        include: {
            physicalAsset: true,
            digitalAsset: true,
            assignedTo: { select: { id: true, name: true, email: true } },
        },
    });

    if (workspaceId) {
        await auditLog({
            workspaceId,
            userId: user.id,
            action: 'asset.created',
            resourceType: 'Asset',
            resourceId: asset.id,
            details: { assetType: asset.assetType, name: asset.name },
        });
    }

    return apiSuccess(completeAsset, undefined, 201);
});
