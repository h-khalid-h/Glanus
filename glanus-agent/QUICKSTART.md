# Quick Start Guide - Glanus Agent

Get the Glanus Agent up and running in 10 minutes.

## Prerequisites

- Rust 1.70+
- macOS/Windows/Linux

## 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.sh | sh
source $HOME/.cargo/env
```

## 2. Install Tauri CLI

```bash
cargo install tauri-cli --version "^2.0.0"
```

## 3. Clone & Build

```bash
cd glanus-agent/src-tauri
cargo build
```

**First build**: ~4-5 minutes  
**Subsequent builds**: ~20-30 seconds

## 4. Configure

Create config file:

**macOS**: `~/Library/Application Support/Glanus/config.toml`

**Windows**: `%APPDATA%\Glanus\config.toml`

**Linux**: `~/.config/glanus/config.toml`

```toml
[agent]
version = "0.1.0"
asset_id = null
workspace_id = null
pre_auth_token = null
registered = false

[server]
api_url = "http://localhost:3000"  # Your Glanus backend
heartbeat_interval = 60

[monitoring]
enabled = true

[updates]
enabled = false  # Disable for development
```

## 5. Run

Windows / macOS:

```bash
cargo tauri dev
```

Linux:

```bash
cargo run
```

The agent will:
1. Start system monitoring
2. Show a system tray icon on Windows/macOS, or run as a daemon on Linux
3. Wait for registration, or auto-register if `asset_id`, `workspace_id`, and `pre_auth_token` are preconfigured

## 6. Register Agent

From your Glanus dashboard:
1. Go to Assets → Add Asset
2. Get the workspace ID and pre-auth token
3. In the agent UI, enter the workspace ID, pre-auth token, and asset ID
4. Click "Register"

The agent is now connected! 🎉

## Development Workflow

```bash
# Make code changes
# Build automatically recompiles
cargo build

# View logs
tail -f /tmp/glanus-agent.log

# Test specific module
cargo test --package app -- monitor::tests
```

## Common Issues

**Build fails**: Clear cache and rebuild
```bash
cargo clean
cargo build
```

**Agent won't start**: Check config file exists and is valid TOML

**Registration fails**: Verify backend is running and API URL is correct

## Next Steps

- Read [README.md](./README.md) for full documentation
- See [installers/](./installers/) to build production packages
- Check [.github/workflows/](./.github/workflows/) for CI/CD setup
