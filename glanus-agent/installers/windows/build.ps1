# Build Glanus Agent MSI Installer
# Usage: .\build.ps1 <version>

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

Write-Host "Building Glanus Agent v$Version for Windows..." -ForegroundColor Green

# Step 1: Build Rust binary in release mode
Write-Host "`n[1/4] Building Rust binary..." -ForegroundColor Cyan
Push-Location ..\..\src-tauri
cargo build --release
if ($LASTEXITCODE -ne 0) {
    throw "Cargo build failed"
}
Pop-Location

# Step 2: Prepare installer files
Write-Host "`n[2/4] Preparing installer files..." -ForegroundColor Cyan
$buildDir = ".\build"
if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

# Copy binary
Copy-Item "..\..\src-tauri\target\release\glanus-agent.exe" $buildDir

# Copy/create config template
@"
[agent]
version = "$Version"
asset_id = null
workspace_id = null
pre_auth_token = null
registered = false

[server]
api_url = "https://api.glanus.com"
heartbeat_interval = 60

[monitoring]
enabled = true
interval = 10
include_processes = true
max_processes = 5

[updates]
enabled = true
check_interval = 86400
auto_install = false
"@ | Out-File -FilePath "$buildDir\config.toml" -Encoding UTF8

# Step 3: Build MSI with WiX
Write-Host "`n[3/4] Building MSI with WiX Toolset..." -ForegroundColor Cyan

# Check if WiX is installed
if (-not (Get-Command candle.exe -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: WiX Toolset not found!" -ForegroundColor Red
    Write-Host "Please install WiX Toolset 3.x from: https://wixtoolset.org/releases/" -ForegroundColor Yellow
    exit 1
}

# Compile WiX source
candle.exe glanus-agent.wxs `
    -dSourceDir=$buildDir `
    -dVersion=$Version `
    -out "$buildDir\glanus-agent.wixobj"

if ($LASTEXITCODE -ne 0) {
    throw "WiX compilation (candle) failed"
}

# Link into MSI
light.exe "$buildDir\glanus-agent.wixobj" `
    -out "glanus-agent-$Version.msi" `
    -ext WixUIExtension `
    -cultures:en-us

if ($LASTEXITCODE -ne 0) {
    throw "WiX linking (light) failed"
}

# Step 4: Sign MSI (optional, requires certificate)
Write-Host "`n[4/4] Signing MSI..." -ForegroundColor Cyan

if ($env:WINDOWS_CERT_PFX -and $env:WINDOWS_CERT_PASSWORD) {
    # Decode base64 certificate from environment
    $certBytes = [Convert]::FromBase64String($env:WINDOWS_CERT_PFX)
    $certPath = "$buildDir\cert.pfx"
    [IO.File]::WriteAllBytes($certPath, $certBytes)
    
    # Sign with SignTool
    signtool.exe sign `
        /f $certPath `
        /p $env:WINDOWS_CERT_PASSWORD `
        /tr http://timestamp.digicert.com `
        /td sha256 `
        /fd sha256 `
        "glanus-agent-$Version.msi"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "MSI signed successfully" -ForegroundColor Green
    } else {
        Write-Host "WARNING: MSI signing failed" -ForegroundColor Yellow
    }
    
    # Cleanup certificate
    Remove-Item $certPath -Force
} else {
    Write-Host "Skipping code signing (no certificate found)" -ForegroundColor Yellow
    Write-Host "Set WINDOWS_CERT_PFX and WINDOWS_CERT_PASSWORD to enable signing" -ForegroundColor Gray
}

# Cleanup
Remove-Item $buildDir -Recurse -Force

Write-Host "`n✓ Build complete!" -ForegroundColor Green
Write-Host "Output: glanus-agent-$Version.msi" -ForegroundColor Cyan
