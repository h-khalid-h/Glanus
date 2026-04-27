---
applyTo: "lib/webrtc/**,lib/remote-desktop/**,glanus-agent/src-tauri/src/remote_desktop/**,glanus-agent/src-tauri/src/input.rs,app/remote/**,components/remote/**"
description: "Rules for WebRTC remote desktop signaling, capture, and input injection."
---

# Remote Desktop & WebRTC

Remote desktop is the highest-impact code path in the platform. A compromised session = full keyboard/mouse control of a customer endpoint. Defense in depth is mandatory.

## Signaling (web side, `lib/webrtc/`, `lib/remote-desktop/`)

- Sessions are first-class entities (`RemoteSession` model). Create / join MUST go through `RemoteSessionService`, not raw Prisma.
- Authorization on every signaling event:
  - `requireAuth()` + `requireWorkspaceRole(["OWNER","ADMIN","TECHNICIAN"])` (or whichever roles the workspace allows).
  - The session's `workspaceId` must match the actor's active workspace.
  - The target agent must belong to that workspace.
- Offer/answer/ICE candidates are stored encrypted-at-rest and short-lived. Never log full SDP — it can contain ICE candidates revealing internal IPs.
- TURN credentials are per-session, time-limited (≤ 1h), and minted server-side. Never embed long-lived TURN secrets in client code.

## Socket events (`lib/websocket/`)

- Every emit is namespaced and authorized. The server MUST verify the socket's session (workspace + role) before relaying signaling between viewer and agent.
- Rate-limit signaling messages per socket to prevent abuse.

## Agent side (`glanus-agent/src-tauri/src/remote_desktop/`)

- Incoming offer is verified against an active `RemoteSession` issued by the backend (signature via `agent-signing`). Do not start capture / input on an unsigned or stale offer.
- The agent shows a **visible, non-suppressible indicator** (system tray badge + on-screen overlay if policy says so) while a session is active. Removing this indicator requires explicit user approval and an audit-logged config change.
- Session start writes an audit event including: actor user id, workspace, agent id, session id, start timestamp, source IP. Same on end.
- Capture frame rate / resolution are bounded — don't allow unbounded values from the offer to drive resource use.

## Input injection (`input.rs`)

- Synthetic input is gated by an active, signed `RemoteSession` with `inputEnabled: true`.
- Drop privileged key combos that could escape sandboxing on Windows (Ctrl+Alt+Del requires the OS-provided SAS bridge, not a synthetic press).
- On macOS, accessibility permission must be explicitly granted by the end user — do not attempt to bypass.
- Stop input within 100ms of session end / WebRTC datachannel close / network drop.

## Recording

- If session recording is enabled (`recordrtc` on the web viewer or server-side), the recording is stored encrypted in the configured object store with workspace-scoped ACLs. Retention is bounded by workspace policy.
- The remote user must be informed BEFORE recording starts (banner / consent prompt configured per workspace).

## Don't

- Don't trust ICE candidates blindly — TURN-only mode for cross-network sessions to avoid leaking internal topology, configurable per workspace.
- Don't store SDP in plaintext logs or analytics.
- Don't allow a viewer to send arbitrary commands ("execute this script") over the WebRTC datachannel — script dispatch goes through the backend's audited path.
- Don't silently fall back to lower security (e.g. unsigned offers if signing fails) — fail closed.
