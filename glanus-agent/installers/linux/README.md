# Glanus Agent — Linux Installer

Builds a single Debian/RPM package that installs **both** the Tauri GUI
launcher *and* a systemd daemon. The same binary handles both modes:

| Mode        | Entry point                         | Started by                          |
|-------------|-------------------------------------|-------------------------------------|
| GUI         | `/usr/bin/glanus-agent`             | desktop launcher / terminal         |
| Daemon      | `/usr/bin/glanus-agent --daemon`    | systemd (`glanus-agent.service`)    |

On Linux the binary auto-detects the mode: it runs headless when invoked
with `--daemon` / `-d`, or when `GLANUS_DAEMON=1` is set; otherwise it
launches the full GUI.

## Prerequisites

Host used to build the package must have:

- Rust toolchain (stable)
- Node.js 18+ and `npm` (to build the React/Vite frontend)
- `dpkg-deb` (pre-installed on Debian/Ubuntu)
- Tauri Linux build deps:
  ```bash
  sudo apt install -y \
      libwebkit2gtk-4.1-dev libgtk-3-dev \
      libayatana-appindicator3-dev librsvg2-dev \
      build-essential curl pkg-config libssl-dev
  ```

## Building

```bash
chmod +x build.sh
./build.sh 0.1.0
```

This will:

1. `npm run build` — produce the frontend dist bundle
2. `cargo build --release` — build the Rust binary with the Tauri GUI
3. Stage `/usr/bin`, systemd service, desktop entry, and icons
4. Package everything with `dpkg-deb`
5. (Optional) build an RPM if `rpmbuild` is present

## Output

- `glanus-agent_<version>_amd64.deb`
- `glanus-agent-<version>-1.x86_64.rpm` (if `rpmbuild` was available)

## Installation

**Ubuntu / Debian / Mint:**
```bash
sudo apt install ./glanus-agent_0.1.0_amd64.deb
# or
sudo dpkg -i glanus-agent_0.1.0_amd64.deb && sudo apt -f install
```

**Fedora / RHEL:**
```bash
sudo dnf install ./glanus-agent-0.1.0-1.x86_64.rpm
```

After install:

- The daemon starts automatically via `systemctl`.
- An entry named **“Glanus Agent”** appears in your application menu.
- You can also launch the GUI from a terminal with `glanus-agent`.

## Runtime dependencies

The DEB declares runtime dependencies on:

- `libwebkit2gtk-4.1-0` (or `libwebkit2gtk-4.0-37` fallback)
- `libgtk-3-0`
- `libayatana-appindicator3-1` (or `libappindicator3-1`)
- `librsvg2-2`
- `libssl3` (or `libssl1.1`)

These are satisfied out-of-the-box on Ubuntu 22.04+, Debian 12+, and
Mint 21+.

## Service control

```bash
sudo systemctl start   glanus-agent
sudo systemctl stop    glanus-agent
sudo systemctl restart glanus-agent
sudo systemctl status  glanus-agent
journalctl -u glanus-agent -f
```

## Uninstall

```bash
sudo apt remove glanus-agent         # Debian/Ubuntu
sudo dnf remove glanus-agent         # Fedora/RHEL
```

## Notes

- **Remote control (WebRTC input simulation) is not available on Linux** —
  the underlying `enigo` crate does not currently support Linux reliably.
  All other features (metrics, registration, heartbeat, inventory,
  discovery, auto-update, remote script execution) work identically to
  the Windows/macOS builds.
- **Headless servers**: run as a systemd daemon; no display or desktop
  environment is needed. The daemon never instantiates the Tauri/GTK
  stack at runtime, even though the shared libraries are linked.
- **Supported distros**: Ubuntu 22.04+, Debian 12+, Mint 21+, Fedora 38+,
  RHEL 9+. Older releases may work but are untested.
