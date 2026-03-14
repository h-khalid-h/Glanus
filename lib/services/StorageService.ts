import { prisma } from '@/lib/db';

/**
 * StorageService — Records file upload audit events for workspace storage.
 *
 * Responsibilities:
 *  - recordStorageUpload: write an audit log entry; actual storage (S3/local) is handled at the route layer
 */
export class StorageService {
    static async recordStorageUpload(
        workspaceId: string,
        userId: string,
        fileId: string,
        fileName: string,
        sizeMB: string,
        mimeType: string,
    ) {
        await prisma.auditLog.create({
            data: {
                workspaceId, userId,
                action: 'storage.file_uploaded',
                resourceType: 'file',
                resourceId: fileId,
                details: { fileName, fileSizeMB: sizeMB, mimeType },
            },
        });
    }
}
