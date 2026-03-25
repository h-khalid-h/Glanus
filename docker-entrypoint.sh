#!/bin/sh
set -e

echo "Applying database migrations..."
prisma migrate deploy || prisma db push --skip-generate

echo "Starting Glanus server..."
exec node server.js
