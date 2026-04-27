# Glanus Agent — Linux headless daemon build
# Uses a two-stage build: compile in a Rust builder image, ship a minimal runtime image.

# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM rust:1.85-slim-bookworm AS builder

# System deps needed at compile time (OpenSSL for reqwest, pkg-config for keyring)
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    libdbus-1-dev \
    libsecret-1-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Cache dependency compilation separately from source
COPY src-tauri/Cargo.toml src-tauri/Cargo.lock ./src-tauri/
RUN mkdir -p src-tauri/src && echo "fn main() {}" > src-tauri/src/main.rs && \
    echo "pub fn placeholder() {}" > src-tauri/src/lib.rs && \
    cd src-tauri && cargo build --release 2>/dev/null || true && \
    rm -f src-tauri/src/main.rs src-tauri/src/lib.rs

# Copy real source and build
COPY src-tauri/ ./src-tauri/
RUN cd src-tauri && cargo build --release

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libdbus-1-3 \
    libsecret-1-0 \
 && rm -rf /var/lib/apt/lists/*

# Create a non-root user for the agent
RUN groupadd --gid 1001 glanus && useradd --uid 1001 --gid glanus --no-create-home glanus

WORKDIR /opt/glanus-agent

COPY --from=builder /build/src-tauri/target/release/app ./glanus-agent

# Config directory (mount your config.toml here via a volume)
RUN mkdir -p /etc/glanus && chown -R glanus:glanus /opt/glanus-agent /etc/glanus

USER glanus

ENV RUST_LOG=info

ENTRYPOINT ["./glanus-agent"]
