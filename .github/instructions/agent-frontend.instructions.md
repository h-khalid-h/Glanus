---
applyTo: "glanus-agent/src/**,glanus-agent/index.html,glanus-agent/vite.config.ts"
description: "Rules for the Tauri agent's React/Vite frontend (renderer)."
---

# Glanus Agent — Frontend (React + Vite, Tauri renderer)

The agent UI runs inside a Tauri webview. It has access to the `@tauri-apps/api` bridge and is constrained by `capabilities/default.json` + the CSP in `tauri.conf.json`.

## Architecture

- React 19 + Vite + TypeScript + Tailwind.
- Keep the UI **thin**: it displays state, triggers Rust commands via `invoke()`, and listens to events. It does NOT make network calls to the Glanus backend directly — that's the Rust side's job (`client.rs`).
- One source of truth for backend state: subscribe to Tauri events emitted from Rust (`emit("agent://...", payload)`), do not poll Rust commands on a timer.

## Calling Rust

```ts
import { invoke } from "@tauri-apps/api/core";

const status = await invoke<AgentStatus>("get_status");
```

- Always type the return value (`invoke<T>`).
- Never pass user-typed strings into a command that the Rust side will execute as a shell argument — the Rust side rejects this anyway, but don't even build that UX.
- Catch and surface errors; never `console.error` and continue silently.

## What the renderer must NOT do

- ✗ No `fetch()` to the Glanus backend. The agent token must stay in Rust / OS keychain.
- ✗ No direct file system reads/writes via `@tauri-apps/plugin-fs` outside the very narrow set granted by capabilities.
- ✗ No shell execution from the renderer (capabilities forbid it; do not request the permission).
- ✗ No `eval`, no `new Function`, no `dangerouslySetInnerHTML` with anything from a Rust event payload (events are trusted-source but treat as data, not code).
- ✗ No third-party analytics, no remote font loading, no CDN scripts (would require widening CSP — don't).

## Styling & UX

- Tailwind only; reuse the same design tokens as the web app where it makes sense (teal cortex, navy nerve, oracle warning, reflex success).
- The window is small (800x600 default). Design for that — no horizontal scroll, no overflowing modals.
- Show clear connection state (online / offline / degraded) at all times — this is a status tool first.

## Build

- `npm run build` (from `glanus-agent/`) runs `tsc -b && vite build`. Output lands in `dist/` which Tauri bundles.
- Don't add SSR / Next-style frameworks. This is a static SPA inside a webview.
- Keep bundle small — avoid heavy chart/table libraries unless replacing existing functionality.
