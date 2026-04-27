# Glanus Agent - macOS Installer

This directory contains the macOS PKG installer configuration.

## Prerequisites

- Xcode Command Line Tools
- Rust toolchain with `universal-apple-darwin` target
- (Optional) Apple Developer account for code signing

## Building

```bash
chmod +x build.sh
./build.sh 0.1.0
```

This will:
1. Build universal binary (Intel + Apple Silicon)
2. Create app bundle
3. Build component package with pkgbuild
4. Build product package with productbuild
5. Sign package (if certificate configured)
6. Notarize (if Apple ID configured)

## Code Signing

Set environment variables for automatic signing:

```bash
export APPLE_DEVELOPER_ID="Developer ID Installer: Your Name (TEAM_ID)"
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAM_ID"
```

## Output

`glanus-agent-{version}.pkg`

## Installation

**Command line**:
```bash
sudo installer -pkg glanus-agent-0.1.0.pkg -target /
```

**GUI**: Double-click the PKG file

## Features

- Installs to `/Applications/Glanus Agent.app`
- Creates LaunchAgent (auto-start on login)
- Stores config in `~/Library/Application Support/Glanus/`
- Universal binary (Intel + Apple Silicon)

## Verify Installation

```bash
launchctl print gui/$(id -u)/com.glanus.agent
cat /Library/LaunchAgents/com.glanus.agent.plist
```

## Uninstall

No built-in uninstaller. Manual removal:

```bash
sudo launchctl bootout gui/$(id -u) /Library/LaunchAgents/com.glanus.agent.plist || true
sudo rm /Library/LaunchAgents/com.glanus.agent.plist
sudo rm -rf "/Applications/Glanus Agent.app"
rm -rf ~/Library/Application\ Support/Glanus
```

## Notarization

For distribution outside the App Store, packages must be notarized by Apple. The build script handles this automatically if credentials are configured.

After notarization, users won't see Gatekeeper warnings.

The build script staples the notarization ticket to the final PKG when notarization succeeds.
