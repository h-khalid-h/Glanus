import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/install-windows?token=...&url=...&workspaceId=...
 *
 * Dynamically generates a PowerShell install script for the Glanus Agent.
 * Downloads the .msi, installs silently, and registers with the server.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const token = searchParams.get('token');
    const apiUrl = searchParams.get('url');
    const workspaceId = searchParams.get('workspaceId');

    if (!token || !apiUrl || !workspaceId) {
        return new NextResponse('Write-Error "Missing required parameters (token, url, workspaceId)"; exit 1', {
            status: 400,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    const origin = apiUrl.replace(/\/api\/?$/, '');
    const msiUrl = `${origin}/api/downloads/glanus-agent-${workspaceId}.msi`;

    const script = `# Glanus Agent - Automated Windows Installer
# Generated dynamically by the Glanus server
# Run in an Administrator PowerShell session

\$ErrorActionPreference = "Stop"
\$AgentMSI = "\$env:TEMP\\GlanusAgent.msi"
\$ApiUrl = "${apiUrl}"
\$Token = "${token}"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Glanus Agent - Windows Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check for admin privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as Administrator."
    exit 1
}

Write-Host "[1/4] Downloading Glanus Agent..." -ForegroundColor Yellow
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "${msiUrl}" -OutFile \$AgentMSI -UseBasicParsing
} catch {
    Write-Error "Download failed: \$_"
    exit 1
}

Write-Host "[2/4] Installing agent..." -ForegroundColor Yellow
\$installArgs = "/i \$AgentMSI PRE_AUTH_TOKEN=\$Token API_ENDPOINT=\$ApiUrl WORKSPACE_ID=${workspaceId} /quiet /norestart"
\$process = Start-Process -FilePath "msiexec.exe" -ArgumentList \$installArgs -Wait -PassThru
if (\$process.ExitCode -ne 0) {
    Write-Error "Installation failed with exit code: \$(\$process.ExitCode)"
    exit 1
}

Write-Host "[3/4] Registering agent with server..." -ForegroundColor Yellow
\$agentPath = "\$env:ProgramFiles\\Glanus\\glanus-agent.exe"
if (Test-Path \$agentPath) {
    & \$agentPath register --token \$Token --url \$ApiUrl
} else {
    Write-Host "[WARN] Agent executable not found at expected path, writing config..." -ForegroundColor DarkYellow
    \$configDir = "\$env:ProgramData\\Glanus"
    New-Item -ItemType Directory -Force -Path \$configDir | Out-Null
    @{
        apiUrl      = \$ApiUrl
        token       = \$Token
        workspaceId = "${workspaceId}"
    } | ConvertTo-Json | Set-Content "\$configDir\\config.json" -Encoding UTF8
}

Write-Host "[4/4] Starting service..." -ForegroundColor Yellow
try {
    Start-Service -Name "GlanusAgent" -ErrorAction SilentlyContinue
} catch {
    Write-Host "[INFO] Service will start on next system boot." -ForegroundColor DarkYellow
}

# Cleanup
Remove-Item -Force \$AgentMSI -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Glanus Agent installed successfully!" -ForegroundColor Green
Write-Host "  Service: Get-Service GlanusAgent" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
`;

    return new NextResponse(script, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': 'inline; filename="install-glanus.ps1"',
            'Cache-Control': 'no-store',
        },
    });
}
