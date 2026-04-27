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

# 1. Rebuild + stage the agent (creates a commit on its own).
AGENT_ARGS=("--commit")
[ -n "$VERSION" ] && AGENT_ARGS=("$VERSION" "${AGENT_ARGS[@]}")
[ -n "$MSG" ]     && AGENT_ARGS+=("-m" "$MSG")
"$REPO_ROOT/scripts/release-agent.sh" "${AGENT_ARGS[@]}"

# 2. If anything web-side is still pending, fold it into the agent commit
# via --amend so EasyPanel rebuilds once, not twice. Skip cleanly if not.
if ! git diff --quiet || ! git diff --cached --quiet \
   || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo
    echo "═══ Folding web-side changes into the same commit ═══"
    git add -A
    git commit --amend --no-edit
fi

# 3. Single push.
echo
echo "═══ Pushing — EasyPanel will rebuild + deploy ═══"
git push

echo
echo "✓ Combined release pushed."
