---
mode: agent
description: "Review a Glanus Agent change (Rust + capabilities + frontend) for security and correctness."
---

# Agent Change Review

Review the agent change targeting: **${input:target:files / PR / feature}**.

## Checklist

### Rust (`glanus-agent/src-tauri/src/`)

- [ ] No `Command::new(...)` outside `command_security.rs`.
- [ ] Allowlist entries for any new executor commands include arg schema, timeout, output cap.
- [ ] No `unwrap()` / `expect()` on values from network, files, or commands.
- [ ] No `tokio::spawn` without an error log path.
- [ ] HTTPS enforced, TLS verified, no `danger_accept_invalid_certs` outside dev-gated flag.
- [ ] Secrets read from OS keychain, never plaintext disk.
- [ ] Logs redact tokens, command stdout, and user paths.
- [ ] Heartbeat / discovery loops catch and recover from errors.
- [ ] `cargo check`, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check` all pass.

### Capabilities (`capabilities/default.json`)

- [ ] No new `shell:*` permissions for the renderer.
- [ ] No new `http:*` permissions (HTTP stays in Rust).
- [ ] `fs:*` permissions are scoped to specific paths, not `$HOME` or recursive `**`.
- [ ] Each new permission has a one-line justification (in PR description if not in JSON).

### CSP (`tauri.conf.json`)

- [ ] No `'unsafe-eval'`.
- [ ] `connect-src` not widened to `*`.
- [ ] `img-src` does not allow remote wildcards or `blob:` without reason.

### Updater

- [ ] Signature verification ON, public key set, endpoints HTTPS.

### Frontend (`glanus-agent/src/`)

- [ ] No `fetch()` to the Glanus backend (must go via Rust).
- [ ] All `invoke()` calls are typed and errors surfaced.
- [ ] No `dangerouslySetInnerHTML` on any payload.
- [ ] No new third-party CDN scripts / fonts (would widen CSP).

### Remote desktop (if touched)

- [ ] Signed `RemoteSession` verified before capture / input start.
- [ ] Visible session indicator preserved.
- [ ] Audit event emitted on session start AND end.
- [ ] Input gated on `inputEnabled` and stops within 100ms of session end.
- [ ] No SDP in logs.

## Output

For each issue: **severity (P0–P3) · location · issue · risk · fix**. End with a summary and a remediation plan. Do not modify code — report only.
