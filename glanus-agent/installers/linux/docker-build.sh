#!/bin/bash
# Build the Linux agent DEB (and RPM if possible) inside Docker.
# Zero host prerequisites besides Docker.
#
# Usage (from repo root or anywhere):
#   ./glanus-agent/installers/linux/docker-build.sh [version]
#
# Output goes to glanus-agent/builds/:
#   - glanus-agent_<version>_amd64.deb   (versioned filename)
#   - glanus-agent.deb                   (alias served by /api/downloads)
#   - glanus-agent-<version>-1.x86_64.rpm (when rpmbuild succeeds)

set -euo pipefail

VERSION="${1:-0.1.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILDS_DIR="$REPO_ROOT/glanus-agent/builds"
# Persistent caches — without these every rebuild recompiles ~400 crates
# from scratch (~15 min cold). Mounting a host-side cache directory means
# Cargo's incremental + dep build artifacts survive across runs and a
# typical edit→rebuild cycle drops to under a minute.
CARGO_CACHE_DIR="$REPO_ROOT/glanus-agent/.cache/cargo"
TARGET_CACHE_DIR="$REPO_ROOT/glanus-agent/.cache/target"
NPM_CACHE_DIR="$REPO_ROOT/glanus-agent/.cache/npm"
IMAGE_TAG="glanus-agent-build:latest"

mkdir -p "$BUILDS_DIR" "$CARGO_CACHE_DIR" "$TARGET_CACHE_DIR" "$NPM_CACHE_DIR"

echo "==> Building Docker image ($IMAGE_TAG)..."
docker build \
    -f "$SCRIPT_DIR/Dockerfile.build" \
    -t "$IMAGE_TAG" \
    "$REPO_ROOT/glanus-agent"

echo
echo "==> Running builder (version=$VERSION)..."
docker run --rm \
    -v "$BUILDS_DIR:/out" \
    -v "$CARGO_CACHE_DIR:/root/.cargo/registry" \
    -v "$TARGET_CACHE_DIR:/src/glanus-agent/src-tauri/target" \
    -v "$NPM_CACHE_DIR:/root/.npm" \
    "$IMAGE_TAG" \
    "$VERSION"

echo
echo "==> Done. Artifacts in $BUILDS_DIR:"
ls -lh "$BUILDS_DIR"

echo
echo "The Next.js /api/downloads route will now serve the new package."
echo "Verify the DEB ships the systemd unit and desktop entry:"
echo "  dpkg-deb -c \"$BUILDS_DIR/glanus-agent.deb\" | grep -E 'glanus-agent\\.(service|desktop)'"
