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
    /// Wheel / trackpad scroll. `delta_x`/`delta_y` are pixel-normalised
    /// (the viewer collapses DOM_DELTA_LINE / DOM_DELTA_PAGE). Positive
    /// `delta_y` matches `WheelEvent.deltaY` — content scrolls down. The
    /// platform driver converts to the local step convention.
    #[serde(alias = "wheel")]
    Scroll {
        #[serde(default)]
        x: i32,
        #[serde(default)]
        y: i32,
        #[serde(rename = "deltaX", default)]
        delta_x: i32,
        #[serde(rename = "deltaY", default)]
        delta_y: i32,
    },
    #[serde(rename = "keydown")]
    KeyDown { key: String },
    #[serde(rename = "keyup")]
    KeyUp { key: String },
    #[serde(rename = "request_keyframe")]
    RequestKeyframe,
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
            if let Ok(session_type) = std::env::var("XDG_SESSION_TYPE") {
                if session_type.to_lowercase() == "wayland" {
                    log::warn!("libxdo: Running on Wayland. X11 input injection may fail. Full Wayland support is planned.");
                }
            }

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
                InputEvent::Scroll { delta_x, delta_y, .. } => {
                    // X11 encodes wheel events as synthetic button clicks:
                    //   4 = wheel up      (negative deltaY)
                    //   5 = wheel down    (positive deltaY)
                    //   6 = wheel left    (negative deltaX)
                    //   7 = wheel right   (positive deltaX)
                    // One step = ~120 px in browser deltaY units (the
                    // de-facto WheelEvent line-height). Clamp to a sane
                    // upper bound so a runaway trackpad gesture cannot
                    // pin the input thread emitting thousands of clicks.
                    const STEP: i32 = 120;
                    const MAX_STEPS: i32 = 20;
                    if delta_y != 0 {
                        let button = if delta_y < 0 { 4 } else { 5 };
                        let steps = ((delta_y.abs() + STEP / 2) / STEP).clamp(1, MAX_STEPS);
                        for _ in 0..steps {
                            self.xdo
                                .click(button)
                                .context("libxdo: scroll click failed")?;
                        }
                    }
                    if delta_x != 0 {
                        let button = if delta_x < 0 { 6 } else { 7 };
                        let steps = ((delta_x.abs() + STEP / 2) / STEP).clamp(1, MAX_STEPS);
                        for _ in 0..steps {
                            self.xdo
                                .click(button)
                                .context("libxdo: scroll click failed")?;
                        }
                    }
                }
                InputEvent::KeyDown { key } => {
                    // `libxdo` accepts X keysyms and arbitrary strings. We
                    // pass through verbatim — basic sanitization only. For
                    // modifier combos like "ctrl+c" the viewer should emit a
                    // sequence of KeyDown/KeyUp events instead of one combo.
                    let translated = dom_key_to_x11_keysym(&key);
                    let sanitized = sanitize_key(&translated);
                    self.xdo
                        .send_keysequence_down(&sanitized, 0)
                        .context("libxdo: send_keysequence_down failed")?;
                }
                InputEvent::KeyUp { key } => {
                    let translated = dom_key_to_x11_keysym(&key);
                    let sanitized = sanitize_key(&translated);
                    self.xdo
                        .send_keysequence_up(&sanitized, 0)
                        .context("libxdo: send_keysequence_up failed")?;
                }
                InputEvent::RequestKeyframe => {}
            }
            Ok(())
        }
    }

    /// Drop characters that could confuse xdotool's key-sequence parser.
    /// libxdo interprets `+` as a modifier separator, so single printable
    /// characters get translated to their libxdo-friendly form.
    fn sanitize_key(key: &str) -> String {
        // Single printable character is fine as-is.
        if key.chars().count() == 1 {
            return key.to_string();
        }
        // Allowlist of X11 keysyms we know libxdo accepts. Anything outside
        // this list falls back to a stripped literal — libxdo will reject
        // unknown tokens cleanly without injecting unintended chord input.
        const KNOWN: &[&str] = &[
            "Return", "Enter", "Escape", "Tab", "BackSpace", "Delete",
            "Home", "End", "Page_Up", "Page_Down", "Insert",
            "Left", "Right", "Up", "Down",
            "space", "Caps_Lock",
            "Shift_L", "Shift_R", "Control_L", "Control_R",
            "Alt_L", "Alt_R", "Super_L", "Super_R", "Meta_L", "Meta_R",
            "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
            "F13", "F14", "F15", "F16", "F17", "F18", "F19", "F20",
        ];
        if KNOWN.iter().any(|k| k.eq_ignore_ascii_case(key)) {
            return key.to_string();
        }
        key.replace('+', "").replace(' ', "")
    }

    /// Translate a DOM `KeyboardEvent.key` value (what the browser viewer
    /// sends) into the closest X11 keysym name libxdo understands.
    /// Returns the input unchanged for anything we don't recognise — the
    /// `sanitize_key` step then either accepts it (single char) or
    /// scrubs it. Single-character keys pass through untouched so case
    /// and unicode characters reach `send_keysequence_*` verbatim.
    fn dom_key_to_x11_keysym(key: &str) -> String {
        if key.chars().count() == 1 {
            return key.to_string();
        }
        match key {
            "Enter" => "Return",
            "Backspace" => "BackSpace",
            "Esc" => "Escape",
            "PageUp" => "Page_Up",
            "PageDown" => "Page_Down",
            "ArrowUp" => "Up",
            "ArrowDown" => "Down",
            "ArrowLeft" => "Left",
            "ArrowRight" => "Right",
            " " => "space",
            "Spacebar" => "space",
            "CapsLock" => "Caps_Lock",
            // Modifiers — DOM doesn't distinguish left/right unless
            // `KeyboardEvent.location` is consulted. Default to the left
            // variant, which is what xdotool also defaults to.
            "Shift" => "Shift_L",
            "Control" | "Ctrl" => "Control_L",
            "Alt" => "Alt_L",
            "Meta" | "OS" | "Super" | "Command" | "Windows" => "Super_L",
            other => other,
        }
        .to_string()
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
    use enigo::{
        Axis, Button as EButton, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings,
    };

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

        /// Translate a DOM `KeyboardEvent.key` value into an enigo `Key`.
        ///
        /// DOM `.key` is already user-locale aware: for printable input it
        /// is the produced character (e.g. "A", "ç", "1"), and for non-
        /// printables it is a well-defined name (e.g. "Enter", "Escape",
        /// "ArrowUp", "F5"). We map the named values to enigo's `Key`
        /// variants and route single characters through `Key::Unicode`.
        ///
        /// Returns `None` for keys we deliberately don't forward (dead
        /// keys, IME composition events). The caller drops them silently.
        fn parse_key(key: &str) -> Option<Key> {
            // Single character → Unicode (covers letters, digits, punct,
            // emoji). NB: enigo on Windows synthesises VK + scan codes for
            // ASCII and uses WM_CHAR for the rest; either way the modifier
            // state from a preceding KeyDown(Shift) is honoured.
            let mut chars = key.chars();
            if let (Some(c), None) = (chars.next(), chars.next()) {
                return Some(Key::Unicode(c));
            }
            // Named keys. Match case-insensitively because some viewers
            // normalise to uppercase. Coverage spans the W3C
            // UIEvents-KeyboardEvent named-key list that real users hit
            // — we don't bother with media/IME keys.
            let k = match key {
                // Editing / navigation
                "Enter" | "Return" => Key::Return,
                "Tab" => Key::Tab,
                "Backspace" => Key::Backspace,
                "Delete" => Key::Delete,
                "Escape" | "Esc" => Key::Escape,
                "Insert" => Key::Insert,
                "Home" => Key::Home,
                "End" => Key::End,
                "PageUp" => Key::PageUp,
                "PageDown" => Key::PageDown,
                // Arrows
                "ArrowUp" | "Up" => Key::UpArrow,
                "ArrowDown" | "Down" => Key::DownArrow,
                "ArrowLeft" | "Left" => Key::LeftArrow,
                "ArrowRight" | "Right" => Key::RightArrow,
                // Modifiers — "Meta" is the cross-platform name for
                // Windows-key / Command. enigo maps it correctly per OS.
                "Shift" => Key::Shift,
                "Control" | "Ctrl" => Key::Control,
                "Alt" => Key::Alt,
                "Meta" | "OS" | "Super" | "Command" | "Windows" => Key::Meta,
                "CapsLock" => Key::CapsLock,
                // Function row
                "F1" => Key::F1,   "F2" => Key::F2,   "F3" => Key::F3,
                "F4" => Key::F4,   "F5" => Key::F5,   "F6" => Key::F6,
                "F7" => Key::F7,   "F8" => Key::F8,   "F9" => Key::F9,
                "F10" => Key::F10, "F11" => Key::F11, "F12" => Key::F12,
                "F13" => Key::F13, "F14" => Key::F14, "F15" => Key::F15,
                "F16" => Key::F16, "F17" => Key::F17, "F18" => Key::F18,
                "F19" => Key::F19, "F20" => Key::F20,
                _ => return None,
            };
            Some(k)
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
                InputEvent::Scroll { delta_x, delta_y, .. } => {
                    // enigo's scroll API takes integer "steps". Browser
                    // `WheelEvent.deltaY` is in pixels; one notch on a
                    // typical wheel is 100–120 px. Convert with a small
                    // floor so trackpad micro-deltas don't disappear.
                    // Sign convention: positive `deltaY` = scroll down,
                    // and enigo `Axis::Vertical` with positive length
                    // also scrolls down on every supported platform.
                    const STEP: i32 = 120;
                    const MAX_STEPS: i32 = 20;
                    let dy_steps = if delta_y == 0 {
                        0
                    } else {
                        let mag = ((delta_y.abs() + STEP / 2) / STEP).clamp(1, MAX_STEPS);
                        mag * delta_y.signum()
                    };
                    let dx_steps = if delta_x == 0 {
                        0
                    } else {
                        let mag = ((delta_x.abs() + STEP / 2) / STEP).clamp(1, MAX_STEPS);
                        mag * delta_x.signum()
                    };
                    if dy_steps != 0 {
                        self.enigo
                            .scroll(dy_steps, Axis::Vertical)
                            .context("enigo: scroll vertical failed")?;
                    }
                    if dx_steps != 0 {
                        self.enigo
                            .scroll(dx_steps, Axis::Horizontal)
                            .context("enigo: scroll horizontal failed")?;
                    }
                }
                InputEvent::KeyDown { key } => {
                    if let Some(k) = Self::parse_key(&key) {
                        self.enigo
                            .key(k, Direction::Press)
                            .context("enigo: key_down failed")?;
                    } else {
                        log::debug!("enigo: dropping unmapped key_down '{key}'");
                    }
                }
                InputEvent::KeyUp { key } => {
                    if let Some(k) = Self::parse_key(&key) {
                        self.enigo
                            .key(k, Direction::Release)
                            .context("enigo: key_up failed")?;
                    } else {
                        log::debug!("enigo: dropping unmapped key_up '{key}'");
                    }
                }
                InputEvent::RequestKeyframe => {}
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
