# Production Dockerfile for Glanus
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install prisma CLI + tsx globally for runtime migrations & seed
RUN npm install -g prisma@6.19.2 tsx@4.19.2

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema + migrations + generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Ship the prebuilt agent installers. /api/downloads/[filename] serves
# .deb / .msi / .pkg files directly from this directory, so the host
# machine that builds the image MUST have run the per-platform installer
# build scripts (see glanus-agent/installers/{linux,macos,windows}/)
# beforehand. Without this COPY, the download-agent endpoint 404s in
# production.
COPY --from=builder /app/glanus-agent/builds ./glanus-agent/builds

# Fail the image build if the Linux installer is missing — better to
# surface a forgotten `cp glanus-agent_X.Y.Z_amd64.deb glanus-agent.deb`
# now than to discover it when the first customer hits the install URL
# and gets a 404. macOS/Windows installers are optional (built on their
# native hosts), so we only enforce the Linux one.
RUN test -s ./glanus-agent/builds/glanus-agent.deb \
    || (echo "ERROR: glanus-agent/builds/glanus-agent.deb missing or empty." \
            "Run: cd glanus-agent/installers/linux && ./build.sh <version>" \
            "and copy the resulting .deb to glanus-agent/builds/glanus-agent.deb"; \
        exit 1)

# Create directory for logs with proper permissions
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

# Drop to non-root
USER nextjs

EXPOSE 8055

ENV PORT=8055
ENV HOSTNAME="0.0.0.0"

# Signal handling: use tini-like exec in entrypoint
STOPSIGNAL SIGTERM

CMD ["./docker-entrypoint.sh"]
