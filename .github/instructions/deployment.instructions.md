---
applyTo: "**"
description: "Deployment & release workflow for the web app and the agent. Repo-wide because every change ships through one of three release scripts."
---

# Glanus — Deployment & Release Workflow

Production runs on **EasyPanel** which auto-builds and redeploys on every push to `main`. The agent ships **inside** the web Docker image as a prebuilt `.deb` — there is no separate agent CI pipeline.

## The three release commands

| Command | Use when | What it does |
| --- | --- | --- |
| `npm run release:web` | Only `app/`, `components/`, `lib/`, `prisma/`, etc. changed | Stages, commits, pushes. **Refuses** to run with pending `glanus-agent/` changes. |
| `npm run release:agent` | Only Rust agent / Tauri code changed | Builds `.deb` natively, stages canonical binary + `DEBIAN/control` version + all `glanus-agent/` source, commits, pushes. |
| `npm run release:all` | A single feature spans both sides | Runs `release:agent`, then folds remaining web changes into the same commit via `--amend`, single push. EasyPanel rebuilds once. |

All three default to commit + push. Pass `--dry-run` (web/all) or omit `--push` (agent) to inspect before pushing.

## Critical invariants

1. **The agent `.deb` lives at `glanus-agent/builds/glanus-agent.deb`** and is git-tracked. The Next.js route [app/api/downloads/[filename]/route.ts](../../app/api/downloads/%5Bfilename%5D/route.ts) streams it directly. The image build in [Dockerfile](../../Dockerfile) hard-fails if that file is missing or empty — never delete it without immediately re-staging a replacement.
2. **Versioned `.deb` files are `.gitignored`.** Only the canonical `glanus-agent.deb` (+ `.sha256`) is committed.
3. **Source ↔ binary parity.** `release:agent` stages everything under `glanus-agent/` (Rust source + canonical binary + `DEBIAN/control`) in one commit so the deployed image's behaviour can always be reproduced from that commit's source tree.
4. **Cross-platform installers** (`.msi`, `.pkg`) must be built on their native hosts (Tauri can't cross-compile cleanly). Drop them at `glanus-agent/builds/glanus-agent.msi` / `glanus-agent.pkg` and stage manually. The `release:*` scripts do **not** rebuild Windows or macOS payloads.
5. **No Docker required locally.** `release:agent` shells out to native `cargo` + `dpkg-deb`. Docker only runs server-side on EasyPanel.

## When both web and agent change

Use `npm run release:all`. Do **not**:
- Run `release:web` first (it will refuse — agent diff is pending).
- Run `release:agent` then `release:web` separately (causes two EasyPanel rebuilds).
- Hand-edit the `.deb` into a web commit (skips the rebuild → drift).

## Build-time deploy guards

The web Docker build will fail-fast on:
- Missing `glanus-agent/builds/glanus-agent.deb` — see the `RUN test -s` guard near the bottom of [Dockerfile](../../Dockerfile).
- Missing required env vars — `lib/env.ts` validates with Zod at startup.

If a build fails in EasyPanel with the agent guard, run `npm run release:agent -- --push` from a Linux box to regenerate and ship.

## Required production env vars (EasyPanel)

See [EasyPanel.md](../../EasyPanel.md) for the full list. The agent-flow critical ones are `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `CSRF_SECRET`, `CRON_SECRET`. Optional but recommended for remote desktop across NATs: `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` (consumed by [app/api/remote/ice-servers/route.ts](../../app/api/remote/ice-servers/route.ts)).

## Refusal protocol

If asked to bypass the release scripts (e.g. "just `git push` the web change without running release:web"), explain that the drift guard exists so the deployed agent version matches the committed source. Only proceed after explicit acknowledgement.
