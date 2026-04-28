//! Screen capture abstraction.
//!
//! The `ScreenCapture` trait exists so the runtime can remain platform-
//! agnostic. We ship an X11 driver (via `xcap`) today; Wayland will land as
//! a separate driver using `ashpd::desktop::screencast::Screencast`.
//!
//! Frames are delivered as raw BGRA pixels + timestamp. Downstream encoders
//! (`peer::video`) convert to I420 for VP8.

use anyhow::Result;

/// A single captured frame, owned by the caller.
///
/// `data` layout is BGRA8888 (xcap default); width × height × 4 bytes.
pub struct Frame {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
    /// Monotonic capture timestamp in microseconds — used by the video
    /// encoder to produce correct RTP timestamps without drifting with
    /// wall-clock adjustments.
    pub timestamp_us: u64,
}

/// Platform-agnostic screen capture driver.
///
/// Implementations MUST be `Send` so the runtime can move them into a
/// dedicated blocking task. Capture itself is typically synchronous (xcap
/// blocks on the X server round-trip).
pub trait ScreenCapture: Send {
    /// Human-readable driver name for logging (e.g. "x11-xcap", "wayland-portal").
    fn name(&self) -> &'static str;

    /// Capture a single frame from the default display.
    fn capture(&mut self) -> Result<Frame>;
}

/// xcap-based capture driver — works on Linux (X11), Windows (DXGI),
/// and macOS (CoreGraphics). The crate auto-selects the right backend
/// per platform, so the agent gets capture parity across operating
/// systems for free.
pub mod xcap_driver {
    //! Cross-platform screen capture via the `xcap` crate.
    //!
    //! `xcap` enumerates monitors through XRandR and blits via XShm when
    //! available. Multi-monitor support is a TODO — today we pick the first
    //! monitor returned by `Monitor::all`. Once the feature stabilises we'll
    //! expose monitor selection through the session offer.

    use super::{Frame, ScreenCapture};
    use anyhow::{anyhow, Context, Result};
    use std::time::Instant;
    use xcap::Monitor;

    pub struct XcapCapture {
        monitor: Monitor,
        epoch: Instant,
    }

    impl XcapCapture {
        pub fn new() -> Result<Self> {
            if let Ok(session_type) = std::env::var("XDG_SESSION_TYPE") {
                if session_type.to_lowercase() == "wayland" {
                    log::warn!("xcap: Running on Wayland. X11 screen capture may fail or return black screens. Full Wayland support is planned.");
                }
            }

            let monitor = Monitor::all()
                .context("xcap: failed to enumerate monitors")?
                .into_iter()
                .next()
                .ok_or_else(|| anyhow!("xcap: no monitors available"))?;
            Ok(Self {
                monitor,
                epoch: Instant::now(),
            })
        }
    }

    impl ScreenCapture for XcapCapture {
        fn name(&self) -> &'static str {
            "x11-xcap"
        }

        fn capture(&mut self) -> Result<Frame> {
            let image = self
                .monitor
                .capture_image()
                .context("xcap: capture_image failed")?;
            // xcap::Image derefs to an `image::RgbaImage`.
            let width = image.width();
            let height = image.height();
            let data = image.into_raw();
            let timestamp_us = self.epoch.elapsed().as_micros() as u64;
            Ok(Frame {
                width,
                height,
                data,
                timestamp_us,
            })
        }
    }
}

/// Choose the best available capture driver for this build target.
/// xcap handles Linux (X11/XRandR), Windows (DXGI Desktop Duplication),
/// and macOS (CoreGraphics) internally — the runtime is OS-agnostic.
pub fn default_driver() -> Result<Box<dyn ScreenCapture>> {
    Ok(Box::new(xcap_driver::XcapCapture::new()?))
}
