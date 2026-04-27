//! VP8 video encoder task.
//!
//! Consumes raw RGBA frames from the capture channel, converts them to
//! I420 YUV, encodes them as VP8 via libvpx (`vpx-encode`), and hands the
//! compressed samples to `TrackLocalStaticSample`, which takes care of RTP
//! packetisation and pacing.
//!
//! The encoder is (re)initialised whenever the source frame size changes
//! (e.g. the user switches monitors mid-session). libvpx requires even
//! dimensions, so we round down odd sizes — the cost is at most one pixel
//! on each axis.

use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use tokio::sync::mpsc;
use vpx_encode::{Config, Encoder, VideoCodecId};
use webrtc::media::Sample;
use webrtc::track::track_local::track_local_static_sample::TrackLocalStaticSample;

use super::capture::Frame;

/// Target output bitrate in kbps. 2 Mbps is a reasonable default for
/// screen content at 1080p30 — libvpx handles the rate control.
const TARGET_BITRATE_KBPS: u32 = 2_000;

/// Nominal frame duration. The capture loop is paced at ~30 fps so this
/// is what the RTP layer will use for pacing.
const FRAME_DURATION: Duration = Duration::from_millis(33);

/// Spawn the encoder task. Takes ownership of the frame receiver and the
/// WebRTC video track; returns the tokio `JoinHandle` so the caller can
/// abort on teardown.
///
/// The encoder runs on a dedicated blocking thread (via `spawn_blocking`)
/// because `vpx_codec_ctx_t` contains raw FFI pointers and is therefore
/// `!Send` across await points. We bridge back to async for
/// `TrackLocalStaticSample::write_sample` using `Handle::block_on`, which
/// tokio explicitly supports from inside `spawn_blocking`.
pub fn spawn(
    mut frame_rx: mpsc::Receiver<Frame>,
    track: Arc<TrackLocalStaticSample>,
) -> tokio::task::JoinHandle<()> {
    tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Handle::current();
        let mut encoder: Option<Encoder> = None;
        let mut dims: (u32, u32) = (0, 0);
        // I420 plane buffer: width*height (Y) + 2 * (width/2)*(height/2) (U,V).
        let mut yuv: Vec<u8> = Vec::new();

        // Periodic stats so we can tell at a glance whether the pipeline is
        // healthy from `journalctl -u glanus-agent`. Without this, a stuck
        // encoder (e.g. write_sample dropping every frame because the track
        // is unbound, or vpx returning empty packet lists) is invisible —
        // it just looks like 0 FPS in the viewer with no log output.
        let mut frames_in: u64 = 0;
        let mut packets_out: u64 = 0;
        let mut samples_written: u64 = 0;
        let mut last_log = std::time::Instant::now();

        while let Some(frame) = frame_rx.blocking_recv() {
            frames_in += 1;
            // libvpx requires even dimensions. Truncate odd widths/heights.
            let w = frame.width & !1;
            let h = frame.height & !1;
            if w == 0 || h == 0 {
                continue;
            }

            if dims != (w, h) {
                log::info!(
                    "remote_desktop: (re)initialising VP8 encoder at {}x{} @ {}kbps",
                    w, h, TARGET_BITRATE_KBPS
                );
                let cfg = Config {
                    width: w,
                    height: h,
                    // 1 ms timebase — pts is in milliseconds.
                    timebase: [1, 1000],
                    bitrate: TARGET_BITRATE_KBPS,
                    codec: VideoCodecId::VP8,
                };
                match Encoder::new(cfg) {
                    Ok(e) => encoder = Some(e),
                    Err(e) => {
                        log::warn!("remote_desktop: VP8 encoder init failed: {e}");
                        encoder = None;
                        dims = (0, 0);
                        continue;
                    }
                };
                dims = (w, h);
                yuv.resize((w as usize * h as usize * 3) / 2, 0);
            }

            let Some(enc) = encoder.as_mut() else {
                continue;
            };

            // Convert the captured RGBA buffer → I420. xcap delivers the
            // image as RGBA (rgb then alpha), despite the Frame doc
            // comment saying "BGRA" — we verified by reading the xcap
            // source. Getting this wrong gives a purple/green output.
            rgba_to_i420(&frame.data, frame.width as usize, frame.height as usize, w as usize, h as usize, &mut yuv);

            let pts_ms = (frame.timestamp_us / 1000) as i64;
            let packets = match enc.encode(pts_ms, &yuv) {
                Ok(p) => p,
                Err(e) => {
                    // Elevated from debug — vpx errors here are the smoking
                    // gun for "0 FPS in the viewer". Repeated bad-pts /
                    // resource-exhausted errors point at libvpx state corruption.
                    log::warn!("remote_desktop: vpx encode error: {e}");
                    continue;
                }
            };

            for pkt in packets {
                packets_out += 1;
                let sample = Sample {
                    data: Bytes::copy_from_slice(pkt.data),
                    duration: FRAME_DURATION,
                    ..Default::default()
                };
                if let Err(e) = rt.block_on(track.write_sample(&sample)) {
                    // Elevated from debug — write_sample failures are
                    // almost always "track is unbound to a transceiver",
                    // which we silently swallowed before and which made
                    // black-screen sessions impossible to diagnose.
                    log::warn!("remote_desktop: write_sample failed: {e:#}");
                } else {
                    samples_written += 1;
                }
            }

            // Roll a 5-second stats window. At ~20 FPS that's ~100 frames
            // per log line — enough signal to spot a stalled stage without
            // flooding the journal.
            if last_log.elapsed() >= std::time::Duration::from_secs(5) {
                log::info!(
                    "remote_desktop: encoder stats — frames_in={} packets_out={} samples_written={}",
                    frames_in, packets_out, samples_written
                );
                frames_in = 0;
                packets_out = 0;
                samples_written = 0;
                last_log = std::time::Instant::now();
            }
        }
    })
}

/// RGBA → I420 (BT.601 limited range).
///
/// Writes into `out` in planar layout: `[Y... ][U... ][V... ]`. Source
/// image dimensions may exceed output dimensions (odd pixels are clipped
/// by the caller before the encoder is initialised).
fn rgba_to_i420(
    rgba: &[u8],
    src_w: usize,
    _src_h: usize,
    dst_w: usize,
    dst_h: usize,
    out: &mut [u8],
) {
    let y_size = dst_w * dst_h;
    let uv_w = dst_w / 2;
    let uv_h = dst_h / 2;
    let (y_plane, rest) = out.split_at_mut(y_size);
    let (u_plane, v_plane) = rest.split_at_mut(uv_w * uv_h);

    // Y plane — full resolution.
    for j in 0..dst_h {
        for i in 0..dst_w {
            let sp = (j * src_w + i) * 4;
            let r = rgba[sp] as i32;
            let g = rgba[sp + 1] as i32;
            let b = rgba[sp + 2] as i32;
            let y = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
            y_plane[j * dst_w + i] = y.clamp(0, 255) as u8;
        }
    }

    // U/V planes — 2x2 subsampled, averaged.
    for j in 0..uv_h {
        for i in 0..uv_w {
            let mut rs = 0i32;
            let mut gs = 0i32;
            let mut bs = 0i32;
            for dy in 0..2 {
                for dx in 0..2 {
                    let sp = ((j * 2 + dy) * src_w + (i * 2 + dx)) * 4;
                    rs += rgba[sp] as i32;
                    gs += rgba[sp + 1] as i32;
                    bs += rgba[sp + 2] as i32;
                }
            }
            let r = rs / 4;
            let g = gs / 4;
            let b = bs / 4;
            let u = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
            let v = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
            u_plane[j * uv_w + i] = u.clamp(0, 255) as u8;
            v_plane[j * uv_w + i] = v.clamp(0, 255) as u8;
        }
    }
}
