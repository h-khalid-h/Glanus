#!/usr/bin/env bash
# Glanus — release BOTH agent and web changes in a single push.
#
# Use when a single feature spans both sides (e.g. agent reports a new
# field + web UI surfaces it). Runs release-agent.sh first to rebuild +
# stage the .deb and all glanus-agent/ source, then release-web.sh to
# pick up the rest of the working tree, then a single `git push`.
#
# Why this exists: release-web.sh deliberately refuses to run with
# pending agent changes (drift guard), and release-agent.sh deliberately
# only touches glanus-agent/ files (so it can be used in isolation).
# This wrapper runs them in the right order and amends them into one
# commit so EasyPanel does a single rebuild instead of two.
#
# Usage:
#   scripts/release-all.sh                       # auto-bump agent version, default msg
#   scripts/release-all.sh 0.2.0                 # explicit agent version
#   scripts/release-all.sh -m 'feat: telemetry'  # custom commit message
#   scripts/release-all.sh --dry-run             # preview without committing

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DRY=0
MSG=""
VERSION=""
while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run)    DRY=1 ;;
        -m|--message) MSG="$2"; shift ;;
        -h|--help)    sed -n '2,18p' "$0"; exit 0 ;;
        -*) echo "Unknown arg: $1" >&2; exit 2 ;;
        *)  VERSION="$1" ;;
    esac
    shift
done

echo "═══ Combined release ═══"
git status --short
[ "$DRY" -eq 1 ] && { echo "(dry run — exiting)"; exit 0; }

# 1. Rebuild all agents (Linux, macOS, Windows) without staging immediately
echo "═══ [1/4] Building Linux Agent ═══"
"$REPO_ROOT/scripts/release-agent-linux.sh" "$VERSION" --no-stage || echo "⚠ Linux agent build failed or skipped. Continuing..."

echo "═══ [2/4] Building macOS Agent ═══"
"$REPO_ROOT/scripts/release-agent-macos.sh" "$VERSION" --no-stage || echo "⚠ macOS agent build failed or skipped. Continuing..."

echo "═══ [3/4] Building Windows Agent ═══"
if command -v pwsh &>/dev/null; then
    pwsh "$REPO_ROOT/scripts/release-agent-windows.ps1" -Version "$VERSION" -NoStage || echo "⚠ Windows agent build failed or skipped. Continuing..."
else
    echo "⚠ pwsh (PowerShell) not found. Skipping Windows build."
fi

# 2. Stage all agent binaries and any web-side changes
echo
echo "═══ [4/4] Folding all changes into a single commit ═══"
git add -A

# Create the single combined commit
if [ -z "$MSG" ]; then
    MSG="release: v$VERSION (all platforms + web)"
fi

git commit -m "$MSG"

echo
echo "═══ Pushing — EasyPanel will rebuild + deploy ═══"
git push

echo
echo "✓ Combined release pushed."
