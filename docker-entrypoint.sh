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
    # Run migrate deploy with full output so errors are visible in deploy logs.
    # We intentionally do NOT fall back to `prisma db push` here: db push ignores
    # the migration history and can drop/alter columns to match the schema,
    # which is unsafe in production (e.g. adding unique constraints without the
    # accompanying backfill step baked into the migration SQL).
    if prisma migrate deploy; then
        echo "[Entrypoint] Migrations applied successfully."
        break
    fi

    if [ $attempt -eq $MAX_RETRIES ]; then
        echo "[Entrypoint] ERROR: Failed to apply migrations after $MAX_RETRIES attempts."
        echo "[Entrypoint] Inspect the output above for the Prisma error and resolve it"
        echo "[Entrypoint] manually (e.g. via 'prisma migrate status' against the target DB)."
        exit 1
    fi
    echo "[Entrypoint] Migration attempt $attempt/$MAX_RETRIES failed. Retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
    RETRY_DELAY=$((RETRY_DELAY * 2))
    attempt=$((attempt + 1))
done

echo "[Entrypoint] Running database seed (platform roles + super-admin)..."
if ! command -v tsx >/dev/null 2>&1; then
    echo "[Entrypoint] ERROR: 'tsx' is not available in PATH; cannot run prisma/seed.ts"
    exit 1
fi

# Seed is required for bootstrapping platform roles/admin user in production.
if tsx prisma/seed.ts; then
    echo "[Entrypoint] Seed completed successfully."
else
    echo "[Entrypoint] ERROR: Seed failed. Aborting startup."
    exit 1
fi

echo "[Entrypoint] Starting Glanus server on port ${PORT:-8055}..."

# Use exec to forward signals (SIGTERM, SIGINT) to Node.js for graceful shutdown
exec node server.js
