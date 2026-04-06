import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/install-macos?token=...&url=...&workspaceId=...
 *
 * Dynamically generates a bash install script for the Glanus Agent on macOS.
 * Downloads the .pkg, installs it, and registers with the server.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const token = searchParams.get('token');
    const apiUrl = searchParams.get('url');
    const workspaceId = searchParams.get('workspaceId');

    if (!token || !apiUrl || !workspaceId) {
        return new NextResponse('#!/bin/bash\necho "Error: Missing required parameters (token, url, workspaceId)"\nexit 1\n', {
            status: 400,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    const origin = apiUrl.replace(/\/api\/?$/, '');
    const pkgUrl = `${origin}/api/downloads/glanus-agent-${workspaceId}.pkg`;

    const script = `#!/bin/bash
# Glanus Agent — Automated macOS Installer
# Generated dynamically by the Glanus server
set -e

AGENT_PKG="/tmp/GlanusAgent-$$.pkg"
API_URL="${apiUrl}"
TOKEN="${token}"

echo "============================================"
echo "  Glanus Agent — macOS Installer"
echo "============================================"
echo ""

# Check for root / sudo
if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] This script must be run with sudo."
    exit 1
fi

echo "[1/4] Downloading Glanus Agent..."
if command -v curl &>/dev/null; then
    curl -fsSL "${pkgUrl}" -o "\$AGENT_PKG"
else
    echo "[ERROR] curl is required."
    exit 1
fi

echo "[2/4] Installing package..."
installer -pkg "\$AGENT_PKG" -target /

echo "[3/4] Registering agent with server..."
AGENT_BIN="/Library/Application Support/Glanus/glanus-agent"
if [ -x "\$AGENT_BIN" ]; then
    "\$AGENT_BIN" register --token "\$TOKEN" --url "\$API_URL"
elif command -v glanus-agent &>/dev/null; then
    glanus-agent register --token "\$TOKEN" --url "\$API_URL"
else
    echo "[WARN] Agent binary not found, writing config manually..."
    mkdir -p "/Library/Application Support/Glanus"
    cat > "/Library/Application Support/Glanus/config.json" <<AGENTCFG
{
    "apiUrl": "\$API_URL",
    "token": "\$TOKEN",
    "workspaceId": "${workspaceId}"
}
AGENTCFG
fi

echo "[4/4] Loading launch daemon..."
if [ -f /Library/LaunchDaemons/com.glanus.agent.plist ]; then
    launchctl load /Library/LaunchDaemons/com.glanus.agent.plist 2>/dev/null || true
    launchctl start com.glanus.agent 2>/dev/null || true
fi

# Cleanup
rm -f "\$AGENT_PKG"

echo ""
echo "============================================"
echo "  Glanus Agent installed successfully!"
echo "  Service: sudo launchctl list | grep glanus"
echo "============================================"
`;

    return new NextResponse(script, {
        status: 200,
        headers: {
            'Content-Type': 'text/x-shellscript; charset=utf-8',
            'Content-Disposition': 'inline; filename="install-glanus.sh"',
            'Cache-Control': 'no-store',
        },
    });
}
