#!/bin/bash
# Rebuild the Glanus Agent .deb on this machine and install it over any
# existing version. Designed for development boxes where the agent is
# installed locally and you want a one-shot "pick up my latest source
# changes" workflow.
#
# Production fleets get updates through the in-binary auto-updater
# (see `src/updater.rs`) — this script is NOT a substitute for that.
#
# Usage:
#   ./rebuild-and-install.sh                # auto-bumps patch version
#   ./rebuild-and-install.sh 0.1.5          # explicit version
#
# Requires: sudo, dpkg, cargo, npm, plus the GTK/WebKit dev headers
# pulled in by Tauri (see installers/linux/README.md).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── 1. Resolve the version we're about to ship ────────────────────────────
# If the caller didn't pass one, auto-bump the patch component of whatever
# is currently in DEBIAN/control. Auto-bump means the next install always
# looks like an upgrade to dpkg, even when iterating quickly.
if [ $# -ge 1 ]; then
    VERSION="$1"
else
    CURRENT="$(grep -E '^Version:' "$SCRIPT_DIR/DEBIAN/control" | awk '{print $2}')"
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    PATCH=$((PATCH + 1))
    VERSION="$MAJOR.$MINOR.$PATCH"
    echo "→ No version provided, auto-bumping $CURRENT → $VERSION"
fi

DEB_FILE="$SCRIPT_DIR/glanus-agent_${VERSION}_amd64.deb"

# ── 2. Build the package ──────────────────────────────────────────────────
echo -e "\n=== Building glanus-agent v$VERSION ==="
cd "$SCRIPT_DIR"
./build.sh "$VERSION"

if [ ! -f "$DEB_FILE" ]; then
    echo "✗ Expected artifact missing: $DEB_FILE" >&2
    exit 1
fi

# ── 3. Install over the existing version ──────────────────────────────────
# `dpkg -i` runs prerm (stops the service), replaces the binary, then
# postinst (reloads systemd + starts the service again). State under
# /var/lib/glanus-agent (auth token, config) is preserved, so the asset
# stays registered.
echo -e "\n=== Installing $DEB_FILE ==="
sudo dpkg -i "$DEB_FILE"

# ── 3b. Strip any stale unit override under /etc/systemd/system ───────────
# Manual installs from earlier dev iterations sometimes drop a unit at
# /etc/systemd/system/glanus-agent.service; that path takes precedence
# over /usr/lib/... and silently shadows the package's unit, so newer
# directives (e.g. ExecStartPre for X11 env detection) never take effect.
if [ -f /etc/systemd/system/glanus-agent.service ]; then
    echo "→ Removing stale /etc/systemd/system/glanus-agent.service override"
    sudo rm -f /etc/systemd/system/glanus-agent.service
    sudo systemctl daemon-reload
    sudo systemctl restart glanus-agent
fi

# ── 4. Confirm it's running with the remote-desktop feature on ────────────
echo -e "\n=== Service status ==="
sudo systemctl --no-pager --full status glanus-agent || true

echo -e "\n=== Recent logs (looking for remote_desktop runtime) ==="
sleep 2
sudo journalctl -u glanus-agent --since "30 seconds ago" --no-pager | tail -30 || true

echo -e "\n✓ Done. The next heartbeat (~60s) will set canRemoteAccess=true."
echo "  Watch live with:  sudo journalctl -u glanus-agent -f"
