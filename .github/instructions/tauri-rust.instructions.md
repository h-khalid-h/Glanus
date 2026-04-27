---
applyTo: "glanus-agent/src-tauri/**/*.rs"
description: "Rules for the Tauri 2 desktop agent — Rust backend (commands, executor, heartbeat, remote desktop)."
---

# Glanus Agent — Rust (Tauri v2)

The agent runs on customer endpoints with elevated privileges. It is **adversarially exposed** to the network and to the web platform it talks to. Treat every byte from outside this process as untrusted.

## Module map (`glanus-agent/src-tauri/src/`)

| File | Responsibility |
| --- | --- |
| `lib.rs`, `main.rs` | Tauri entrypoint, `tauri::Builder` setup, command registration |
| `commands.rs` | `#[tauri::command]` handlers callable from the React frontend |
| `client.rs` | HTTP client to the Glanus web backend (auth header, retries) |
| `registration.rs` | One-time agent enrollment, token exchange, key generation |
| `heartbeat.rs` | Periodic telemetry POST (system metrics, online state) |
| `executor.rs` | Runs scripts / commands dispatched from the platform |
| `command_security.rs` | **Allowlist + sanitization for executor input** — DO NOT bypass |
| `inventory.rs`, `software.rs` | Hardware / software inventory collection |
| `discovery.rs` | LAN discovery (must respect configured CIDR scope) |
| `monitor.rs` | Resource sampling |
| `updater.rs` | Self-update via Tauri updater (signed bundles only) |
| `storage.rs`, `config.rs` | Local persistence (config, keys, queue) |
| `remote_desktop/` | WebRTC offer/answer + capture/input bridge |
| `input.rs` | Synthetic mouse/keyboard injection (remote desktop) |

## Command security (HARD rules)

- **All shell / process execution goes through `command_security.rs`.** Never call `std::process::Command::new(...).args(user_input)` directly anywhere else.
- The allowlist is closed by default. New commands require:
  1. An explicit allowlist entry with argument schema.
  2. Argument validation (no shell metacharacters: `;`, `|`, `&`, `$`, backticks, `>`, `<`, newlines).
  3. Bounded execution (timeout, output size cap).
  4. Drop privileges where possible (no implicit `sudo`/`runas`).
- Never invoke `sh -c`, `bash -c`, `cmd /c`, `powershell -Command` with interpolated user input. If a command must be a one-liner, it must be hard-coded.
- Scripts dispatched from the platform are signed (`agent-signing`). Verify the signature in `executor.rs` BEFORE writing the script to disk or executing.
- Script files are written to a private, mode-`0700` directory (`config.rs::script_dir()`); delete after execution; never reuse filenames.

## Network & I/O

- The HTTP client (`client.rs`) MUST:
  - Pin to HTTPS for the production backend URL (configurable for dev only).
  - Send the agent token via `Authorization` header — never as a query param.
  - Verify TLS certificates; do not set `danger_accept_invalid_certs` outside a clearly gated dev flag.
  - Respect server-issued `Retry-After`; back off exponentially.
- Discovery scans must be bounded by configured CIDRs and rate-limited. Do not scan public IPs.

## Storage & secrets

- Agent tokens, signing keys, and registration secrets live in the OS keychain (Tauri keyring / `keyring` crate) — never in plaintext files.
- `storage.rs` writes to a per-user data dir (`tauri::api::path::app_data_dir()`); never to world-readable locations.
- Logs must redact tokens, command stdout that may contain credentials, and full filesystem paths of user data.

## Concurrency & error handling

- Use `tokio` runtime via Tauri. Don't block the runtime — wrap CPU-heavy or blocking IO in `tokio::task::spawn_blocking`.
- Return `Result<T, AgentError>` from commands; map to a serializable error shape for the frontend. Never `unwrap()` / `expect()` on values derived from network input.
- Heartbeat / executor loops must catch panics (`std::panic::catch_unwind` or task-level supervision) and continue; one bad payload must not kill the agent.

## Build & checks

After ANY Rust change run, from `glanus-agent/src-tauri/`:

```bash
cargo check
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --check
```

If you add a dependency, justify it (compile time, supply chain) and prefer well-maintained crates already in `Cargo.lock`.

## Don't

- Don't add new `#[tauri::command]`s that take a free-form string and pass it to a process / FS call.
- Don't widen capabilities (see `capabilities/default.json` rules).
- Don't disable the Tauri updater signature check.
- Don't log raw command output at INFO/DEBUG without redaction.
- Don't `tokio::spawn` fire-and-forget tasks without an error log path.
