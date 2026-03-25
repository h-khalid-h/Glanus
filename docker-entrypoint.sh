#!/bin/sh
set -e

echo "Pushing database schema..."
prisma db push --accept-data-loss

echo "Starting Glanus server..."
exec node server.js
