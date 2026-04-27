---
applyTo: "glanus-agent/src-tauri/capabilities/**,glanus-agent/src-tauri/tauri.conf.json"
description: "Rules for Tauri capabilities, CSP, and bundle config — least privilege."
---

# Tauri Capabilities & CSP

The agent's permission model is enforced by `capabilities/default.json` and `tauri.conf.json`. These files are **security boundaries** — every change must be justified and reviewed.

## Principle: least privilege

- Default-deny. Only grant a permission if a specific, named feature requires it.
- Prefer narrow permissions (`fs:allow-read-text-file` for a specific scope) over broad ones (`fs:default`, `fs:allow-app-read-recursive` on `$HOME`).
- Never grant `shell:allow-execute` with a wildcard `args` pattern. All shell execution should go through Rust commands using `command_security.rs`, NOT through the Tauri shell plugin from the frontend.
- Never grant `http:default` — outbound HTTP belongs in Rust (`client.rs`), not the JS bridge.

## What requires explicit user approval before adding

- Any `fs:*` permission that targets `$HOME`, `$DOCUMENT`, `$DOWNLOAD`, `$DESKTOP`, or `**` recursive scopes.
- `shell:*` of any kind from the frontend.
- `dialog:allow-*` writing arbitrary files.
- `os:allow-*` returning hostname / username / arch (these leak fingerprintable data — only enable if a feature truly needs it).
- `notification:default` (can be used for spam if abused by the renderer).
- Any plugin not yet listed in `Cargo.toml` — adding one is a supply-chain decision.

## CSP (`tauri.conf.json` → `app.security.csp`)

Current baseline:

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; img-src 'self' data:
```

Rules:

- Do not add `'unsafe-eval'`. Ever.
- Do not broaden `connect-src` to `*`. Pin to specific origins (e.g. `https://api.glanus.app wss://api.glanus.app`) once the backend URL stabilizes.
- Do not add `frame-src` unless we host an embedded payment / OAuth frame, in which case allowlist exact origins.
- `script-src 'unsafe-inline'` is currently required for Vite HMR in dev — when production-hardening, split dev/prod CSP and remove `'unsafe-inline'` for prod.
- `img-src data:` is acceptable for icons; do not add `blob:` or remote wildcards.

## Updater

- `bundle.updater.active: true` requires `pubkey` set to the Glanus signing pubkey and `endpoints` over HTTPS only.
- Never disable signature verification. Never set `dangerousInsecureTransportProtocol`.

## When asked to "just allow X"

Refuse silently-accepting. Respond with:
1. Why the permission is dangerous (concrete attack: e.g. "`fs:allow-write-recursive` on `$HOME` lets a compromised renderer drop a startup script").
2. The narrower alternative (specific path scope, or move the action into a Rust command with validation).
3. Proceed only after the user accepts the trade-off.
