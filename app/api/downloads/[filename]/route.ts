import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

const MIME_MAP: Record<string, string> = {
    '.msi': 'application/x-msi',
    '.pkg': 'application/x-newton-compatible-pkg',
    '.deb': 'application/vnd.debian.binary-package',
    '.exe': 'application/x-msdownload',
    '.rpm': 'application/x-rpm',
};

const ALLOWED_EXT = new Set(Object.keys(MIME_MAP));

/**
 * GET /api/downloads/[filename]
 *
 * Serves agent installer binaries from the builds directory.
 * Validates filename to prevent path traversal.
 */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ filename: string }> }
) {
    const { filename } = await context.params;

    // Validate filename — must be alphanumeric/hyphens/dots with known extension
    if (!filename || !/^[\w.-]+$/.test(filename)) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Map extension to OS subdirectory
    let osDir = 'linux';
    if (['.msi', '.exe'].includes(ext)) osDir = 'windows';
    else if (['.pkg', '.dmg'].includes(ext)) osDir = 'macos';

    // Look for the file in the OS-specific builds directory
    const buildsDir = path.join(process.cwd(), 'glanus-agent', 'builds', osDir);

    // Try exact filename first, then fall back to generic binary (glanus-agent.ext)
    // Workspace-specific filenames like glanus-agent-<workspaceId>.deb map to the
    // same generic binary — the workspace config is injected by the install script.
    const candidates = [
        path.join(buildsDir, filename),
        path.join(buildsDir, `glanus-agent${ext}`),
    ];

    let resolvedPath: string | null = null;
    for (const candidate of candidates) {
        // Prevent path traversal
        if (!candidate.startsWith(buildsDir)) continue;
        try {
            await fs.stat(candidate);
            resolvedPath = candidate;
            break;
        } catch {
            // try next candidate
        }
    }

    if (!resolvedPath) {
        return NextResponse.json(
            { error: 'Agent binary not found. Build the agent first using the installers in glanus-agent/installers/.' },
            { status: 404 }
        );
    }

    try {
        const stat = await fs.stat(resolvedPath);

        // Stream the binary instead of buffering the whole 6+ MB DEB into
        // memory. `fs.readFile` blocks the response until the entire file
        // is loaded — on the install path this manifests as a multi-second
        // pause between curl printing "[1/4] Downloading..." and bytes
        // actually flowing. Streaming keeps TTFB ~constant regardless of
        // file size and lets curl's progress meter advance smoothly.
        const nodeStream = createReadStream(resolvedPath);
        // Web ReadableStream is what NextResponse expects.
        const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

        return new NextResponse(webStream, {
            status: 200,
            headers: {
                'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': stat.size.toString(),
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch {
        return NextResponse.json(
            { error: 'Failed to read agent binary.' },
            { status: 500 }
        );
    }
}
