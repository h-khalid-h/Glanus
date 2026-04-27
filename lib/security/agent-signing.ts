import crypto from 'crypto';

function createPrivateKeyFromPem(envName: string): crypto.KeyObject | null {
    const pem = process.env[envName];
    if (!pem) return null;
    try {
        return crypto.createPrivateKey(pem);
    } catch {
        return null;
    }
}

function sha256Hex(input: string): string {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface SignedCommandPayload {
    id: string;
    language: string;
    script: string;
}

export function signCommandPayload(command: SignedCommandPayload): { signature: string; issuedAt: string } | null {
    const privateKey = createPrivateKeyFromPem('COMMAND_SIGNING_PRIVATE_KEY_PEM');
    if (!privateKey) return null;

    const issuedAt = new Date().toISOString();
    const payload = `${command.id}|${command.language.toUpperCase()}|${sha256Hex(command.script)}|${issuedAt}`;
    const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');

    return { signature, issuedAt };
}

export function signUpdatePayload(version: string, checksum: string): string | null {
    const privateKey = createPrivateKeyFromPem('UPDATE_SIGNING_PRIVATE_KEY_PEM');
    if (!privateKey) return null;

    const payload = `${version}|${checksum}`;
    return crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');
}
