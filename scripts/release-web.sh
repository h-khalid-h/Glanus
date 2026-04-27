#!/usr/bin/env bash
# Glanus — release a web-app-only change to production.
#
# Sibling to release-agent.sh. Use this when you've changed Next.js / API
# / Prisma code but NOT the Rust agent. EasyPanel rebuilds the image
# (~2 min) and redeploys; the existing committed agent .deb is reused as-is.
#
# Refuses to run if there are uncommitted changes under glanus-agent/
# (those should go through release-agent.sh so the canonical .deb stays
# in lockstep with the source tree).
#
# Usage:
#   scripts/release-web.sh                    # commit staged + push
#   scripts/release-web.sh -m 'feat: ...'     # custom commit message
#   scripts/release-web.sh --dry-run          # show what would happen

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DRY=0
MSG=""
while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run)    DRY=1 ;;
        -m|--message) MSG="$2"; shift ;;
        -h|--help)    sed -n '2,15p' "$0"; exit 0 ;;
        *)  echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
    shift
done

# ── Guard: agent code changes must go through release-agent.sh ───────────
# Otherwise the source under glanus-agent/src-tauri can drift from the
# committed glanus-agent/builds/glanus-agent.deb, leading to a deployed
# image whose advertised agent version doesn't match the binary it serves.
if ! git diff --quiet -- glanus-agent/ \
   || ! git diff --cached --quiet -- glanus-agent/; then
    echo "✗ Detected pending changes under glanus-agent/." >&2
    echo "  Use scripts/release-agent.sh instead so the canonical .deb is rebuilt." >&2
    git status --short glanus-agent/ >&2
    exit 1
fi

# ── Show what would be committed ─────────────────────────────────────────
STAGED="$(git diff --cached --name-only)"
UNSTAGED="$(git diff --name-only)"
UNTRACKED="$(git ls-files --others --exclude-standard)"

if [ -z "$STAGED$UNSTAGED$UNTRACKED" ]; then
    echo "✓ Nothing to release — working tree is clean."
    exit 0
fi

echo "═══ Files that will be included ═══"
echo "$STAGED$UNSTAGED$UNTRACKED" | sed '/^$/d' | sort -u

if [ "$DRY" -eq 1 ]; then
    echo
    echo "(dry run — exiting before commit)"
    exit 0
fi

# Stage everything not already staged.
git add -A

# Auto-derive a commit message from the most recent commit's prefix
# convention if none provided. Falls back to a generic label.
if [ -z "$MSG" ]; then
    MSG="web: $(date -u +%Y-%m-%d) update"
fi

echo
echo "═══ Committing ═══"
git commit -m "$MSG"

echo
echo "═══ Pushing — EasyPanel will rebuild + deploy ═══"
git push

echo
echo "✓ Web release pushed. Watch the deploy in EasyPanel."
