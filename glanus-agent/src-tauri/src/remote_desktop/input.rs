//! Input injection abstraction.
//!
//! The viewer sends input events over a WebRTC data channel (`"input"`). The
//! runtime deserialises them into `InputEvent`s and hands them to a platform-
//! specific `InputControl` driver.
//!
//! Today the only driver is X11 via `libxdo`. Wayland injection will be a
//! separate driver using the RemoteDesktop portal + `ashpd::desktop::remote_desktop`.

use anyhow::Result;
use serde::Deserialize;

/// Wire format for viewer → agent input events. Field names match the
/// frontend (`RemoteDesktopViewer`).
///
/// The `x`/`y` fields on MouseDown/MouseUp/Click are accepted from the
/// wire for forward compatibility but currently unused — the cursor is
/// positioned via MouseMove immediately before the click, so libxdo only
/// needs the button. Kept on the type so the deserialiser doesn't reject
/// the viewer's payload shape.
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum InputEvent {
    MouseMove { x: i32, y: i32 },
    #[serde(rename = "mousedown")]
    MouseDown { x: i32, y: i32, button: MouseButton },
    #[serde(rename = "mouseup")]
    MouseUp { x: i32, y: i32, button: MouseButton },
    Click { x: i32, y: i32, button: MouseButton },
    #[serde(rename = "keydown")]
    KeyDown { key: String },
    #[serde(rename = "keyup")]
    KeyUp { key: String },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MouseButton {
    Left,
    Middle,
    Right,
}

impl MouseButton {
    /// libxdo / X11 button ordinal (1=left, 2=middle, 3=right).
    pub fn to_x11(&self) -> i32 {
        match self {
            MouseButton::Left => 1,
            MouseButton::Middle => 2,
            MouseButton::Right => 3,
        }
    }
}

/// Platform-agnostic input driver.
pub trait InputControl: Send {
    fn name(&self) -> &'static str;
    fn handle(&mut self, event: InputEvent) -> Result<()>;
}

/// No-op driver used when no real injector is available on the host (for
/// example, the daemon runs as root without a `DISPLAY` and cannot reach
/// the user's X server). The peer still negotiates and streams video —
/// input events are silently dropped with a one-time warning.
pub struct NoopInput {
    warned: bool,
}

impl NoopInput {
    pub fn new() -> Self {
        Self { warned: false }
    }
}

impl InputControl for NoopInput {
    fn name(&self) -> &'static str {
        "noop (view-only)"
    }

    fn handle(&mut self, _event: InputEvent) -> Result<()> {
        if !self.warned {
            log::warn!(
                "remote_desktop: input events are being dropped — no injector available. \
                 On Linux systemd deployments set `Environment=DISPLAY=:0` and point \
                 `XAUTHORITY` at the active user's auth file in the service unit."
            );
            self.warned = true;
        }
        Ok(())
    }
}

#[cfg(target_os = "linux")]
pub mod x11 {
    //! X11 input driver using the `libxdo` crate (a thin wrapper around
    //! `libxdo.so`, the same library behind `xdotool`).
    //!
    //! Requires `libxdo-dev` on the build host and `libxdo3` at runtime.
    //! On Wayland this driver will fail at construction time (no DISPLAY /
    //! `XWaylandError`), at which point the runtime should fall back to the
    //! portal-based driver.

    use super::{InputControl, InputEvent};
    use anyhow::{Context, Result};
    use libxdo::XDo;

    pub struct XdoInput {
        xdo: XDo,
    }

    // SAFETY: `XDo` wraps a `*mut Struct_xdo` handle. The xdo_* functions in
    // libxdo are documented as safe to call from a single thread at a time
    // (the library is not reentrant). `XdoInput` is owned by exactly one
    // tokio task that serially consumes `InputEvent`s, so the handle never
    // crosses a thread boundary while in use — only its ownership moves
    // once into the spawned task. Asserting `Send` here is sound for that
    // single-owner usage pattern.
    unsafe impl Send for XdoInput {}

    impl XdoInput {
        pub fn new() -> Result<Self> {
            let xdo = XDo::new(None).context("libxdo: failed to initialise")?;
            Ok(Self { xdo })
        }
    }

    impl InputControl for XdoInput {
        fn name(&self) -> &'static str {
            "x11-libxdo"
        }

        fn handle(&mut self, event: InputEvent) -> Result<()> {
            match event {
                InputEvent::MouseMove { x, y } => {
                    self.xdo
                        .move_mouse(x, y, 0)
                        .context("libxdo: move_mouse failed")?;
                }
                InputEvent::MouseDown { button, .. } => {
                    self.xdo
                        .mouse_down(button.to_x11())
                        .context("libxdo: mouse_down failed")?;
                }
                InputEvent::MouseUp { button, .. } => {
                    self.xdo
                        .mouse_up(button.to_x11())
                        .context("libxdo: mouse_up failed")?;
                }
                InputEvent::Click { button, .. } => {
                    self.xdo
                        .click(button.to_x11())
                        .context("libxdo: click failed")?;
                }
                InputEvent::KeyDown { key } => {
                    // `libxdo` accepts X keysyms and arbitrary strings. We
                    // pass through verbatim — basic sanitization only. For
                    // modifier combos like "ctrl+c" the viewer should emit a
                    // sequence of KeyDown/KeyUp events instead of one combo.
                    let sanitized = sanitize_key(&key);
                    self.xdo
                        .send_keysequence_down(&sanitized, 0)
                        .context("libxdo: send_keysequence_down failed")?;
                }
                InputEvent::KeyUp { key } => {
                    let sanitized = sanitize_key(&key);
                    self.xdo
                        .send_keysequence_up(&sanitized, 0)
                        .context("libxdo: send_keysequence_up failed")?;
                }
            }
            Ok(())
        }
    }

    /// Drop characters that could confuse xdotool's key-sequence parser.
    /// libxdo interprets `+` as a modifier separator, so single printable
    /// characters get translated to their libxdo-friendly form.
    fn sanitize_key(key: &str) -> String {
        // Keep a permissive allowlist: letters, digits, and well-known key names.
        // xdotool accepts names like "Return", "Escape", "Left", "a", "A", "1".
        if key.len() == 1 {
            return key.to_string();
        }
        // Whitelist of commonly-named non-printables. Anything else falls back
        // to the literal string and libxdo will reject unknown tokens safely.
        const KNOWN: &[&str] = &[
            "Return", "Enter", "Escape", "Tab", "BackSpace", "Delete",
            "Home", "End", "Page_Up", "Page_Down",
            "Left", "Right", "Up", "Down",
            "space", "Shift_L", "Shift_R", "Control_L", "Control_R",
            "Alt_L", "Alt_R", "Super_L", "Super_R",
            "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
        ];
        if KNOWN.iter().any(|k| k.eq_ignore_ascii_case(key)) {
            return key.to_string();
        }
        // Strip dangerous separators; libxdo will reject unknown tokens.
        key.replace('+', "").replace(' ', "")
    }
}

/// Choose the best available input driver for this build target. Falls back
/// to a no-op driver (view-only mode) if the platform-specific driver fails
/// to initialise — this keeps the WebRTC handshake alive so the viewer sees
/// a connected (if read-only) session instead of a timeout.

#[cfg(any(target_os = "windows", target_os = "macos"))]
pub mod enigo_driver {
    //! Cross-platform input driver using the `enigo` crate. Used on
    //! Windows (SendInput) and macOS (CGEvent). enigo on Linux is
    //! unreliable (X11 / Wayland mix), so Linux uses libxdo instead.

    use super::{InputControl, InputEvent, MouseButton};
    use anyhow::{Context, Result};
    use enigo::{Button as EButton, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};

    pub struct EnigoInput {
        enigo: Enigo,
    }

    impl EnigoInput {
        pub fn new() -> Result<Self> {
            let enigo = Enigo::new(&Settings::default())
                .context("enigo: failed to initialise input driver")?;
            Ok(Self { enigo })
        }

        fn map_button(b: &MouseButton) -> EButton {
            match b {
                MouseButton::Left => EButton::Left,
                MouseButton::Middle => EButton::Middle,
                MouseButton::Right => EButton::Right,
            }
        }
    }

    impl InputControl for EnigoInput {
        fn name(&self) -> &'static str { "enigo" }

        fn handle(&mut self, event: InputEvent) -> Result<()> {
            match event {
                InputEvent::MouseMove { x, y } => {
                    self.enigo
                        .move_mouse(x, y, Coordinate::Abs)
                        .context("enigo: move_mouse failed")?;
                }
                InputEvent::MouseDown { button, .. } => {
                    self.enigo
                        .button(Self::map_button(&button), Direction::Press)
                        .context("enigo: mouse_down failed")?;
                }
                InputEvent::MouseUp { button, .. } => {
                    self.enigo
                        .button(Self::map_button(&button), Direction::Release)
                        .context("enigo: mouse_up failed")?;
                }
                InputEvent::Click { button, .. } => {
                    self.enigo
                        .button(Self::map_button(&button), Direction::Click)
                        .context("enigo: click failed")?;
                }
                InputEvent::KeyDown { key } => {
                    if let Some(c) = key.chars().next().filter(|_| key.chars().count() == 1) {
                        self.enigo
                            .key(Key::Unicode(c), Direction::Press)
                            .context("enigo: key_down failed")?;
                    }
                }
                InputEvent::KeyUp { key } => {
                    if let Some(c) = key.chars().next().filter(|_| key.chars().count() == 1) {
                        self.enigo
                            .key(Key::Unicode(c), Direction::Release)
                            .context("enigo: key_up failed")?;
                    }
                }
            }
            Ok(())
        }
    }
}

#[cfg(target_os = "linux")]
pub fn default_driver() -> Result<Box<dyn InputControl>> {
    match x11::XdoInput::new() {
        Ok(d) => Ok(Box::new(d)),
        Err(e) => {
            log::warn!(
                "remote_desktop: X11 input driver unavailable ({e:#}); \
                 falling back to view-only mode"
            );
            Ok(Box::new(NoopInput::new()))
        }
    }
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
pub fn default_driver() -> Result<Box<dyn InputControl>> {
    match enigo_driver::EnigoInput::new() {
        Ok(d) => Ok(Box::new(d)),
        Err(e) => {
            log::warn!(
                "remote_desktop: enigo input driver unavailable ({e:#}); \
                 falling back to view-only mode"
            );
            Ok(Box::new(NoopInput::new()))
        }
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
pub fn default_driver() -> Result<Box<dyn InputControl>> {
    Ok(Box::new(NoopInput::new()))
}
