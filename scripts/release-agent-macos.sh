#!/usr/bin/env bash
# Glanus — release a new agent build for macOS.
#
# This script mirrors release-agent-linux.sh for macOS (.pkg).
# Usage:
#   scripts/release-agent-macos.sh              # auto-bump patch
#   scripts/release-agent-macos.sh 0.2.0        # explicit version
#   scripts/release-agent-macos.sh --no-stage   # build only, don't `git add`
#   scripts/release-agent-macos.sh --commit     # also `git commit`
#   scripts/release-agent-macos.sh --push       # implies --commit, then `git push`

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS_INSTALLER_DIR="$REPO_ROOT/glanus-agent/installers/macos"
BUILDS_DIR="$REPO_ROOT/glanus-agent/builds/macos"
# Read version from Linux control file for consistency across platforms if auto-bumping
CONTROL_FILE="$REPO_ROOT/glanus-agent/installers/linux/DEBIAN/control"

# ── Args ──────────────────────────────────────────────────────────────────
STAGE=1
COMMIT=0
PUSH=0
VERSION=""
MSG=""
while [ $# -gt 0 ]; do
    case "$1" in
        --no-stage)   STAGE=0 ;;
        --commit)     COMMIT=1 ;;
        --push)       COMMIT=1; PUSH=1 ;;
        -m|--message) MSG="$2"; shift ;;
        -h|--help)
            sed -n '2,13p' "$0"; exit 0 ;;
        --) shift; break ;;
        -*) echo "Unknown option: $1" >&2; exit 2 ;;
        *)  VERSION="$1" ;;
    esac
    shift
done

# Auto-bump patch if version not supplied.
if [ -z "$VERSION" ]; then
    CURRENT="$(grep -E '^Version:' "$CONTROL_FILE" | awk '{print $2}')"
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    PATCH=$((PATCH + 1))
    VERSION="$MAJOR.$MINOR.$PATCH"
    echo "→ No version provided, using version from linux control file auto-bump: $VERSION"
fi

PKG_FILE="$MACOS_INSTALLER_DIR/glanus-agent-$VERSION.pkg"
CANONICAL="$BUILDS_DIR/glanus-agent.pkg"
VERSIONED="$BUILDS_DIR/glanus-agent-$VERSION.pkg"

# ── 1. Build the .pkg ────────────────────────────────────────────────────
echo
echo "═══ [1/3] Building glanus-agent v$VERSION (.pkg) ═══"
cd "$MACOS_INSTALLER_DIR"
./build.sh "$VERSION"

if [ ! -f "$PKG_FILE" ]; then
    echo "✗ Expected artifact missing: $PKG_FILE" >&2
    exit 1
fi

# ── 2. Stage into builds/macos/ ──────────────────────────────────────────
echo
echo "═══ [2/3] Staging into $BUILDS_DIR ═══"
mkdir -p "$BUILDS_DIR"
cp -v "$PKG_FILE" "$VERSIONED"
cp -v "$PKG_FILE" "$CANONICAL"

SHA="$(sha256sum "$CANONICAL" | awk '{print $1}')"
echo "$SHA  glanus-agent.pkg  v$VERSION" > "$BUILDS_DIR/glanus-agent.pkg.sha256"
echo "  sha256: $SHA"

# ── 3. Stage in git ──────────────────────────────────────────────────────
if [ "$STAGE" -eq 1 ]; then
    echo
    echo "═══ [3/3] Staging canonical artifact for git ═══"
    cd "$REPO_ROOT"
    
    git add \
        "$CANONICAL" \
        "$BUILDS_DIR/glanus-agent.pkg.sha256"
    
    if [ "$COMMIT" -eq 1 ]; then
        : "${MSG:=agent(macos): v$VERSION}"
        echo
        echo "═══ [4/4] Committing ═══"
        git commit -m "$MSG"
        if [ "$PUSH" -eq 1 ]; then
            echo
            echo "═══ Pushing to origin ═══"
            git push
            echo
            echo "✓ Released v$VERSION for macOS."
        else
            echo
            echo "✓ Committed v$VERSION for macOS. Push when ready:  git push"
        fi
    else
        echo
        echo "✓ Ready. Next steps:"
        echo "    git commit -m 'agent(macos): v$VERSION'"
        echo "    git push"
    fi
else
    echo
    echo "✓ Build complete (skipped git staging due to --no-stage)."
fi
