---
mode: agent
description: "Add a new Tauri command (Rust) on the agent following least-privilege and signed-execution rules."
---

# New Tauri Command

Add a new agent command: **${input:command:e.g. 'list_running_services — return enumerated OS services with status'}**.

## Steps

1. **Decide the security envelope:**
   - Does it execute a process? → Must go through `command_security.rs` allowlist with bounded args, timeout, and output cap.
   - Does it touch the filesystem? → Confine to `app_data_dir()` or a specific allowlisted scope; mode 0700 for any new dir.
   - Does it read secrets / tokens? → Read from OS keychain, never disk plaintext.
   - Does it expose data to the renderer? → Confirm the renderer needs it; never expose tokens or raw filesystem paths of user data.
2. **Implement in the appropriate Rust module:**
   - Inventory / system info → `inventory.rs` or `software.rs`.
   - Network → `discovery.rs` (respect configured CIDR scope).
   - Process / script execution → `executor.rs` + `command_security.rs`.
   - Remote desktop → `remote_desktop/`.
3. **Add the `#[tauri::command]` handler** in `commands.rs`:
   - Returns `Result<T, AgentError>` where `T: serde::Serialize`.
   - No `unwrap()` / `expect()` on values derived from input or network.
   - Validate every argument; reject shell metacharacters.
   - Wrap blocking work in `tokio::task::spawn_blocking`.
4. **Register the command** in `lib.rs` (`tauri::generate_handler![...]`).
5. **Capabilities:** if the command requires a new Tauri permission, add the **narrowest possible** entry to `capabilities/default.json`. Do NOT grant `shell:*` to the frontend; do NOT widen `fs:*` to `$HOME` or recursive scopes. Justify in a comment.
6. **Frontend wrapper** (`glanus-agent/src/`) calls `invoke<T>("name", args)` with a typed return; surface errors visibly.
7. **Checks:** from `glanus-agent/src-tauri/`:
   ```bash
   cargo check
   cargo clippy --all-targets --all-features -- -D warnings
   cargo fmt --check
   ```

## Refuse / push back if asked to

- Take a free-form string from the renderer and execute it.
- Disable signature verification on dispatched scripts.
- Log raw stdout that may contain credentials.
- Add a permission broader than the minimum needed.
