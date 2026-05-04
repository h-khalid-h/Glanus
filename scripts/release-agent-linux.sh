#!/usr/bin/env bash
# Glanus — release a new agent build into the web image's payload.
#
# This is the single supported workflow for shipping agent updates to
# production. It encodes Recommendation A from docs:
#
#   1. Build the platform installer locally (Linux native, .deb).
#   2. Copy it into glanus-agent/builds/ under BOTH the versioned name
#      (kept locally for diffing / rollback) AND the canonical name
#      (glanus-agent.deb) which is what the Next.js /api/downloads route
#      streams to install scripts in production.
#   3. Stage the canonical file for git so EasyPanel picks it up on push.
#
# What this script does NOT do:
#   • Build macOS .pkg or Windows .msi  — those must be built on their
#     native hosts (Tauri can't cross-compile cleanly). Drop the resulting
#     glanus-agent.pkg / glanus-agent.msi into glanus-agent/builds/ by hand.
#
# By default the script stops at `git add` so you can review the diff
# before triggering an EasyPanel rebuild. Pass --commit or --push to
# automate those steps as well.
#
# Usage:
#   scripts/release-agent.sh              # auto-bump patch
# Usage:
#   scripts/release-agent.sh                 # auto-bump patch, build, stage
#   scripts/release-agent.sh 0.2.0           # explicit version
#   scripts/release-agent.sh --no-stage      # build only, don't `git add`
#   scripts/release-agent.sh --commit        # also `git commit` (uses default msg)
#   scripts/release-agent.sh --push          # implies --commit, then `git push`
#   scripts/release-agent.sh -m 'msg' --push # custom commit message + push

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINUX_INSTALLER_DIR="$REPO_ROOT/glanus-agent/installers/linux"
BUILDS_DIR="$REPO_ROOT/glanus-agent/builds/linux"
CONTROL_FILE="$LINUX_INSTALLER_DIR/DEBIAN/control"

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
            sed -n '2,32p' "$0"; exit 0 ;;
        --) shift; break ;;
        -*) echo "Unknown option: $1" >&2; exit 2 ;;
        *)  VERSION="$1" ;;
    esac
    shift
done

# Auto-bump patch if version not supplied. Mirrors the same logic in
# rebuild-and-install.sh so dev/prod stay in lockstep.
if [ -z "$VERSION" ]; then
    CURRENT="$(grep -E '^Version:' "$CONTROL_FILE" | awk '{print $2}')"
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    PATCH=$((PATCH + 1))
    VERSION="$MAJOR.$MINOR.$PATCH"
    echo "→ No version provided, auto-bumping $CURRENT → $VERSION"
fi

DEB_FILE="$LINUX_INSTALLER_DIR/glanus-agent_${VERSION}_amd64.deb"
CANONICAL="$BUILDS_DIR/glanus-agent.deb"
VERSIONED="$BUILDS_DIR/glanus-agent_${VERSION}_amd64.deb"

# ── 1. Build the .deb ────────────────────────────────────────────────────
echo
echo "═══ [1/3] Building glanus-agent v$VERSION (.deb) ═══"
cd "$LINUX_INSTALLER_DIR"
./build.sh "$VERSION"

if [ ! -f "$DEB_FILE" ]; then
    echo "✗ Expected artifact missing: $DEB_FILE" >&2
    exit 1
fi

# ── 2. Stage into builds/ ────────────────────────────────────────────────
echo
echo "═══ [2/3] Staging into $BUILDS_DIR ═══"
mkdir -p "$BUILDS_DIR"
cp -v "$DEB_FILE" "$VERSIONED"
cp -v "$DEB_FILE" "$CANONICAL"

# Record the SHA256 of the canonical artifact alongside it so consumers
# (the AgentVersion seed, an external CDN, etc.) can pin the exact build.
SHA="$(sha256sum "$CANONICAL" | awk '{print $1}')"
echo "$SHA  glanus-agent.deb  v$VERSION" > "$BUILDS_DIR/glanus-agent.deb.sha256"
echo "  sha256: $SHA"

# ── 3. Stage in git (canonical only — versioned artifacts are .gitignored) ─
if [ "$STAGE" -eq 1 ]; then
    echo
    echo "═══ [3/3] Staging canonical artifact + agent source for git ═══"
    cd "$REPO_ROOT"
    # Stage the canonical .deb + sha256 + control file so the deployed
    # image and the source tree never disagree on shipping version.
    # ALSO stage every other change under glanus-agent/ — typically Rust
    # source edits that motivated the rebuild. Without this they get
    # orphaned: a fresh .deb ships but the source it was built from is
    # still uncommitted, so the next contributor can't reproduce it.
    git add \
        "$CANONICAL" \
        "$BUILDS_DIR/glanus-agent.deb.sha256" \
        "$CONTROL_FILE" \
        "$REPO_ROOT/glanus-agent"
    git status --short glanus-agent/

    if [ "$COMMIT" -eq 1 ]; then
        : "${MSG:=agent: v$VERSION}"
        echo
        echo "═══ [4/4] Committing ═══"
        git commit -m "$MSG"
        if [ "$PUSH" -eq 1 ]; then
            echo
            echo "═══ Pushing to origin — EasyPanel will rebuild + deploy ═══"
            git push
            echo
            echo "✓ Released v$VERSION. Watch the deploy in EasyPanel."
        else
            echo
            echo "✓ Committed v$VERSION. Push when ready:  git push"
        fi
    else
        echo
        echo "✓ Ready. Next steps:"
        echo "    git commit -m 'agent: v$VERSION — <changelog>'"
        echo "    git push        # EasyPanel will rebuild + deploy"
        echo
        echo "  (or rerun with --push to do both automatically)"
    fi
else
    echo
    echo "✓ Build complete (skipped git staging due to --no-stage)."
fi
