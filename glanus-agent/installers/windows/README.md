# Glanus Agent - Windows Installer

This directory contains the Windows MSI installer configuration using WiX Toolset.

## Prerequisites

- WiX Toolset 3.x ([Download](https://wixtoolset.org/releases/))
- Visual Studio Build Tools (for signing)
- PowerShell 5.1+

## Building

```powershell
.\build.ps1 0.1.0
```

This will:
1. Build Rust binary in release mode
2. Prepare installer files
3. Compile WiX source with candle.exe
4. Link into MSI with light.exe
5. Sign MSI (if certificate configured)

## Code Signing

Set environment variables for automatic signing:

```powershell
$env:WINDOWS_CERT_PFX = "base64-encoded-certificate"
$env:WINDOWS_CERT_PASSWORD = "certificate-password"
```

## Output

`glanus-agent-{version}.msi`

## Installation

**Silent install**:
```powershell
msiexec /i glanus-agent-0.1.0.msi /quiet /qn
```

**Interactive install**:
```powershell
.\glanus-agent-0.1.0.msi
```

## Features

- Installs to `C:\Program Files\Glanus Agent\`
- Adds a Startup shortcut so the tray app launches when a user signs in
- Adds Start Menu shortcuts
- Stores config in `%APPDATA%\Glanus\`

## Verify Installation

```powershell
Get-Process glanus-agent -ErrorAction SilentlyContinue
Test-Path "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\Glanus Agent.lnk"
```

## Uninstall

```powershell
msiexec /x glanus-agent-0.1.0.msi /quiet
```

Or use "Add/Remove Programs" in Control Panel.
