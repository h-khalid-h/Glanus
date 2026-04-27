# Changelog

All notable changes to the Glanus Agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Settings UI in system tray menu
- Offline mode (queue metrics when backend unavailable)
- Rollback mechanism for failed updates
- Enhanced logging with log rotation
- Performance metrics dashboard

## [0.1.0] - 2026-02-16

### Added
- Initial release
- System monitoring (CPU, RAM, Disk, Network, Processes)
- System tray UI with glassmorphism design
- Backend registration with workspace and asset
- 60-second heartbeat loop with metrics reporting
- Remote script execution (PowerShell, Bash, Python)
- Command queue with concurrent execution (max 3)
- Auto-updater with SHA-256 verification
- Maintenance window scheduling (2-4 AM)
- Secure token storage in OS keychain
- Cross-platform support (Windows, macOS, Linux)
- Windows MSI installer with user-login auto-start for the tray app
- macOS PKG installer with LaunchAgent
- Linux DEB package with systemd service
- CI/CD pipeline with GitHub Actions

### Security
- Auth tokens stored in OS keychain
- SHA-256 checksum verification for updates
- HTTPS-only communication
- Pre-auth token clearing after registration

### Performance
- Incremental build time: 20-30 seconds
- Memory usage (idle): <100 MB
- CPU usage (idle): <5%

## [0.0.1] - 2026-01-15

### Added
- Project initialization
- Rust and Tauri setup
- Basic project structure
