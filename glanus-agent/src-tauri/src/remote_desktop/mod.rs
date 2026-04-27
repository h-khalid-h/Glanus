//! Remote desktop host module (feature-gated).
//!
//! This module is compiled ONLY when the `remote_desktop` cargo feature is
//! enabled. It provides:
//!
//!  * `signaling`  — polling loop against `/api/agent/remote/active` +
//!                   `PATCH /api/remote/sessions/:id/signaling`.
//!  * `capture`    — `ScreenCapture` trait + X11 implementation via `xcap`.
//!                   Wayland (ashpd RemoteDesktop portal) is a planned driver.
//!  * `input`      — `InputControl` trait + X11 implementation via `libxdo`.
//!                   Wayland (portal-based) is a planned driver.
//!  * `peer`       — `webrtc-rs` peer connection + VP8 video track glue.
//!
//! All units are trait-driven so platform-specific drivers (Wayland, Windows,
//! macOS) can be added without touching the session/runtime logic.
//!
//! The module is intentionally isolated from the rest of the agent: it is
//! spawned as a single background task from `lib.rs::run()` and interacts
//! with the backend purely over HTTPS — it does not share any locks or
//! state with the heartbeat or inventory loops.

pub mod capture;
pub mod encoder;
pub mod input;
pub mod peer;
pub mod runtime;
pub mod signaling;

pub use runtime::run;
