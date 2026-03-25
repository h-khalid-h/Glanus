#!/bin/sh
set -e

echo "Running database migrations..."
prisma migrate deploy

echo "Starting Glanus server..."
exec node server.js
