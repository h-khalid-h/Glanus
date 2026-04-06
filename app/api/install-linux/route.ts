import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/install-linux?token=...&url=...&workspaceId=...
 *
 * Dynamically generates a self-contained bash install script for the Glanus Agent.
 * The script downloads the .deb package, installs it, and registers with the server.
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
    const debUrl = `${origin}/api/downloads/glanus-agent-${workspaceId}.deb`;

    const script = `#!/bin/bash
# Glanus Agent — Automated Linux Installer
# Generated dynamically by the Glanus server
set -e

AGENT_DEB="/tmp/glanus-agent-$$.deb"
API_URL="${apiUrl}"
TOKEN="${token}"

echo "============================================"
echo "  Glanus Agent — Linux Installer"
echo "============================================"
echo ""

# Check for root / sudo
if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] This script must be run as root (use sudo)."
    exit 1
fi

# Detect package manager
if command -v dpkg &>/dev/null; then
    PKG_TYPE="deb"
elif command -v rpm &>/dev/null; then
    PKG_TYPE="rpm"
else
    echo "[ERROR] No supported package manager found (dpkg or rpm required)."
    exit 1
fi

echo "[1/4] Downloading Glanus Agent..."
if command -v curl &>/dev/null; then
    curl -fsSL "${debUrl}" -o "\$AGENT_DEB"
elif command -v wget &>/dev/null; then
    wget -q "${debUrl}" -O "\$AGENT_DEB"
else
    echo "[ERROR] curl or wget is required."
    exit 1
fi

echo "[2/4] Installing package..."
if [ "\$PKG_TYPE" = "deb" ]; then
    dpkg -i "\$AGENT_DEB" || apt-get install -f -y
else
    rpm -i "\$AGENT_DEB"
fi

echo "[3/4] Registering agent with server..."
if command -v glanus-agent &>/dev/null; then
    glanus-agent register --token "\$TOKEN" --url "\$API_URL"
elif [ -x /usr/bin/glanus-agent ]; then
    /usr/bin/glanus-agent register --token "\$TOKEN" --url "\$API_URL"
else
    echo "[WARN] glanus-agent binary not found in PATH, writing config manually..."
    mkdir -p /var/lib/glanus-agent
    cat > /var/lib/glanus-agent/config.json <<AGENTCFG
{
    "apiUrl": "\$API_URL",
    "token": "\$TOKEN",
    "workspaceId": "${workspaceId}"
}
AGENTCFG
fi

echo "[4/4] Starting service..."
systemctl daemon-reload 2>/dev/null || true
systemctl enable glanus-agent 2>/dev/null || true
systemctl start glanus-agent 2>/dev/null || true

# Cleanup
rm -f "\$AGENT_DEB"

echo ""
echo "============================================"
echo "  Glanus Agent installed successfully!"
echo "  Service: systemctl status glanus-agent"
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
