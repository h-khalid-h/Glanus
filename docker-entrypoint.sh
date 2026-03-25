#!/bin/sh
set -e

# ============================================
# Glanus Production Entrypoint
# ============================================

MAX_RETRIES=5
RETRY_DELAY=3

echo "[Entrypoint] Applying database migrations..."
attempt=1
while [ $attempt -le $MAX_RETRIES ]; do
    if prisma migrate deploy 2>/dev/null; then
        echo "[Entrypoint] Migrations applied successfully."
        break
    elif prisma db push --skip-generate 2>/dev/null; then
        echo "[Entrypoint] Schema pushed successfully (fallback)."
        break
    else
        if [ $attempt -eq $MAX_RETRIES ]; then
            echo "[Entrypoint] ERROR: Failed to apply migrations after $MAX_RETRIES attempts."
            exit 1
        fi
        echo "[Entrypoint] Migration attempt $attempt/$MAX_RETRIES failed. Retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
        RETRY_DELAY=$((RETRY_DELAY * 2))
        attempt=$((attempt + 1))
    fi
done

echo "[Entrypoint] Starting Glanus server on port ${PORT:-8055}..."

# Use exec to forward signals (SIGTERM, SIGINT) to Node.js for graceful shutdown
exec node server.js
