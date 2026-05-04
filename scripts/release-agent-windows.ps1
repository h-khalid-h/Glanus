<#
.SYNOPSIS
Glanus — release a new agent build for Windows.

.DESCRIPTION
This script mirrors release-agent-linux.sh for Windows (.msi).

.EXAMPLE
.\scripts\release-agent-windows.ps1
.\scripts\release-agent-windows.ps1 -Version 0.2.0
.\scripts\release-agent-windows.ps1 -NoStage
.\scripts\release-agent-windows.ps1 -Commit
.\scripts\release-agent-windows.ps1 -Push
#>
param(
    [string]$Version = "",
    [switch]$NoStage,
    [switch]$Commit,
    [switch]$Push,
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path "$PSScriptRoot\.." | Select-Object -ExpandProperty Path
$WindowsInstallerDir = "$RepoRoot\glanus-agent\installers\windows"
$BuildsDir = "$RepoRoot\glanus-agent\builds\windows"
$ControlFile = "$RepoRoot\glanus-agent\installers\linux\DEBIAN\control"

if ($Push) { $Commit = $true }

if ([string]::IsNullOrWhiteSpace($Version)) {
    # Auto-bump reading from Linux control file
    $controlContent = Get-Content $ControlFile -Raw
    if ($controlContent -match "(?m)^Version:\s*(.+)$") {
        $current = $matches[1].Trim()
        $parts = $current.Split('.')
        $parts[2] = [int]$parts[2] + 1
        $Version = $parts -join "."
        Write-Host "→ No version provided, using version from linux control file auto-bump: $Version" -ForegroundColor Cyan
    } else {
        throw "Could not parse version from DEBIAN/control"
    }
}

$MsiFile = "$WindowsInstallerDir\glanus-agent-$Version.msi"
$Canonical = "$BuildsDir\glanus-agent.msi"
$Versioned = "$BuildsDir\glanus-agent-$Version.msi"

# ── 1. Build the .msi ────────────────────────────────────────────────────
Write-Host "`n═══ [1/3] Building glanus-agent v$Version (.msi) ═══" -ForegroundColor Cyan
Push-Location $WindowsInstallerDir
.\build.ps1 -Version $Version
Pop-Location

if (-not (Test-Path $MsiFile)) {
    throw "✗ Expected artifact missing: $MsiFile"
}

# ── 2. Stage into builds/windows/ ────────────────────────────────────────
Write-Host "`n═══ [2/3] Staging into $BuildsDir ═══" -ForegroundColor Cyan
if (-not (Test-Path $BuildsDir)) {
    New-Item -ItemType Directory -Path $BuildsDir | Out-Null
}
Copy-Item $MsiFile -Destination $Versioned -Force -Verbose
Copy-Item $MsiFile -Destination $Canonical -Force -Verbose

$Sha = (Get-FileHash -Path $Canonical -Algorithm SHA256).Hash.ToLower()
"$Sha  glanus-agent.msi  v$Version`n  sha256: $Sha" | Out-File -FilePath "$BuildsDir\glanus-agent.msi.sha256" -Encoding ASCII

# ── 3. Stage in git ──────────────────────────────────────────────────────
if (-not $NoStage) {
    Write-Host "`n═══ [3/3] Staging canonical artifact for git ═══" -ForegroundColor Cyan
    Push-Location $RepoRoot
    
    git add "$Canonical" "$BuildsDir\glanus-agent.msi.sha256"
    
    if ($Commit) {
        if ([string]::IsNullOrWhiteSpace($Message)) {
            $Message = "agent(windows): v$Version"
        }
        Write-Host "`n═══ [4/4] Committing ═══" -ForegroundColor Cyan
        git commit -m "$Message"
        
        if ($Push) {
            Write-Host "`n═══ Pushing to origin ═══" -ForegroundColor Cyan
            git push
            Write-Host "`n✓ Released v$Version for Windows." -ForegroundColor Green
        } else {
            Write-Host "`n✓ Committed v$Version for Windows. Push when ready:  git push" -ForegroundColor Green
        }
    } else {
        Write-Host "`n✓ Ready. Next steps:" -ForegroundColor Green
        Write-Host "    git commit -m 'agent(windows): v$Version'"
        Write-Host "    git push"
    }
    Pop-Location
} else {
    Write-Host "`n✓ Build complete (skipped git staging due to -NoStage)." -ForegroundColor Green
}
