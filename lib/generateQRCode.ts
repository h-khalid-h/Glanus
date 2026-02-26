import { logError } from '@/lib/logger';
import QRCode from 'qrcode';

/**
 * Generate a QR code as a Base64 data URL
 * @param data - Data to encode in the QR code
 * @param options - QRCode generation options
 * @returns Promise resolving to Base64 data URL
 */
export async function generateQRCode(
    data: string,
    options?: {
        width?: number;
        margin?: number;
        errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    }
): Promise<string> {
    try {
        const qrCodeDataURL = await QRCode.toDataURL(data, {
            width: options?.width || 200,
            margin: options?.margin || 2,
            errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
        });

        return qrCodeDataURL;
    } catch (error: unknown) {
        logError('QR code generation failed', error);
        throw new Error('Failed to generate QR code');
    }
}

/**
 * Generate QR code for an asset
 * Encodes asset ID and basic info
 */
export async function generateAssetQRCode(assetId: string, assetName?: string): Promise<string> {
    const qrData = JSON.stringify({
        id: assetId,
        name: assetName,
        type: 'asset',
        url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/assets/${assetId}`,
    });

    return generateQRCode(qrData, {
        width: 300,
        errorCorrectionLevel: 'H', // High error correction for physical labels
    });
}
