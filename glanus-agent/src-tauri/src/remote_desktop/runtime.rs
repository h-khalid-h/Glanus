//! Remote-desktop runtime loop.
//!
//! Polls the backend for an active session, sets up a WebRTC peer, pumps
//! frames from the capture driver into the encoder sink, and forwards
//! signaling messages both ways.

use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use serde_json::Value;
use tokio::sync::Mutex;
use tokio::time;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;

use crate::config::AgentConfig;
use crate::storage::SecureStorage;

use super::capture;
use super::encoder;
use super::input;
use super::peer::{PeerEvent, PeerSession};
use super::signaling::{ActiveSession, SignalingClient};

/// Poll interval between "is there a session for me?" checks. Kept short
/// so there's minimal latency between the viewer creating a session and
/// the agent accepting the offer; the endpoint is cheap and idempotent.
const POLL_INTERVAL: Duration = Duration::from_secs(1);

/// Target capture frame interval (≈ 20 FPS). Tighten once the encoder
/// can keep up without backpressure.
const FRAME_INTERVAL: Duration = Duration::from_millis(50);

/// Main runtime entry point — call once at agent startup after registration.
pub async fn run(config: AgentConfig) -> Result<()> {
    let auth_token = SecureStorage::get_token()
        .context("remote_desktop: failed to read auth token")?
        .context("remote_desktop: agent not registered yet")?;

    let signaling = Arc::new(SignalingClient::new(
        config.server.api_url.clone(),
        auth_token,
    ));

    log::info!("remote_desktop: host runtime online, polling for sessions");

    // Track the currently-active session id so we don't re-accept the same
    // offer on every poll cycle. Also tracks sessions that failed to
    // handshake so we don't thrash by retrying the same broken offer every
    // 5 seconds — the entry is only cleared once the backend reports a
    // different session (or none at all).
    let active_session_id: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));

    loop {
        time::sleep(POLL_INTERVAL).await;

        let session = match signaling.fetch_active_session().await {
            Ok(s) => s,
            Err(e) => {
                log::warn!("remote_desktop: signaling fetch failed: {e:#}");
                continue;
            }
        };

        // If the backend no longer advertises a session, clear our dedup
        // slot so a fresh session id can re-enter the loop cleanly.
        let Some(session) = session else {
            let mut guard = active_session_id.lock().await;
            if guard.is_some() {
                log::debug!("remote_desktop: no active session, clearing dedup slot");
                *guard = None;
            }
            continue;
        };

        // Wait for the viewer to post the SDP offer before claiming the
        // dedup slot. The backend creates the session row *before* the
        // browser has posted its offer, so on a fast poll we'll briefly
        // see the session with `offer: null`. If we claimed the slot
        // now we'd bail with "session has no offer" and the slot would
        // stick, starving the real negotiation that arrives ~100ms later.
        if session.offer.is_none() {
            log::debug!(
                "remote_desktop: session {} has no offer yet, waiting",
                session.id
            );
            continue;
        }

        // Deduplicate — same session id across polls (including after a
        // handshake failure). The slot only clears when the backend returns
        // a different id or None, which prevents retry-storms on a session
        // whose offer we can't satisfy.
        {
            let mut guard = active_session_id.lock().await;
            if guard.as_deref() == Some(session.id.as_str()) {
                continue;
            }
            *guard = Some(session.id.clone());
        }

        let signaling = signaling.clone();
        tokio::spawn(async move {
            let sid = session.id.clone();
            if let Err(e) = handle_session(session, signaling).await {
                log::warn!("remote_desktop: session {sid} ended with error: {e:#}");
            } else {
                log::info!("remote_desktop: session {sid} ended cleanly");
            }
            // Intentionally do NOT clear `active_session_id` here — the
            // outer loop clears it when the backend drops the session.
        });
    }
}

async fn handle_session(
    session: ActiveSession,
    signaling: Arc<SignalingClient>,
) -> Result<()> {
    let ActiveSession {
        id,
        offer,
        ice_candidates,
        view_only,
    } = session;

    let offer = offer.ok_or_else(|| anyhow::anyhow!("session has no offer"))?;
    let offer: RTCSessionDescription =
        serde_json::from_value(offer).context("malformed remote offer")?;

    log::info!(
        "remote_desktop: accepting offer for session {id} (view_only={view_only})"
    );

    // The agent is the authoritative enforcer of view-only — the viewer's
    // UI gating is convenience-only, a determined client could still craft
    // input frames. When `view_only` is set we swap to the no-op driver so
    // every InputEvent that lands on the data channel is silently dropped.
    let input_driver: Box<dyn input::InputControl> = if view_only {
        Box::new(input::NoopInput::new())
    } else {
        input::default_driver()
            .context("remote_desktop: failed to initialise input driver")?
    };
    log::info!("remote_desktop: input driver = {}", input_driver.name());

    // Fetch ICE servers (STUN + TURN) from the backend before negotiating.
    // Agents behind NAT need TURN; STUN-only would relay-fail silently.
    let ice_servers_wire = signaling.fetch_ice_servers().await;
    let ice_servers: Vec<webrtc::ice_transport::ice_server::RTCIceServer> = ice_servers_wire
        .into_iter()
        .map(|e| webrtc::ice_transport::ice_server::RTCIceServer {
            urls: e.urls.into_vec(),
            username: e.username.unwrap_or_default(),
            credential: e.credential.unwrap_or_default(),
            ..Default::default()
        })
        .collect();
    log::info!("remote_desktop: using {} ICE server entries", ice_servers.len());

    let mut peer = PeerSession::accept_offer(offer, input_driver, ice_servers).await?;
    let ice_handle = peer.ice_handle();

    // Apply any ICE candidates the viewer already produced before our answer.
    for c in &ice_candidates {
        if c.get("source").and_then(Value::as_str) == Some("agent") {
            continue;
        }
        if let Err(e) = ice_handle.add_remote_ice(c.clone()).await {
            log::debug!("remote_desktop: skip remote ICE: {e:#}");
        }
    }
    let applied = ice_candidates.len();

    // ── Trickle-ICE poller ─────────────────────────────────────────────
    // The viewer continues to push ICE candidates after the offer. Poll
    // the signaling state every 1s and apply any new tail entries. Stops
    // once the session is no longer ACTIVE or the parent task aborts.
    let poll_signaling = signaling.clone();
    let poll_id = id.clone();
    let poll_ice = ice_handle.clone();
    let ice_poll_handle = tokio::spawn(async move {
        let mut tick = time::interval(Duration::from_secs(1));
        tick.set_missed_tick_behavior(time::MissedTickBehavior::Delay);
        let mut applied = applied;
        loop {
            tick.tick().await;
            let state = match poll_signaling.fetch_signaling_state(&poll_id).await {
                Ok(s) => s,
                Err(e) => {
                    log::debug!("remote_desktop: ICE poll failed: {e:#}");
                    continue;
                }
            };
            if state.status != "ACTIVE" {
                log::info!(
                    "remote_desktop: session {poll_id} status = {}, stopping ICE poll",
                    state.status
                );
                break;
            }
            if state.ice_candidates.len() <= applied {
                continue;
            }
            for c in &state.ice_candidates[applied..] {
                if c.get("source").and_then(Value::as_str) == Some("agent") {
                    continue;
                }
                if let Err(e) = poll_ice.add_remote_ice(c.clone()).await {
                    log::debug!("remote_desktop: skip trickle ICE: {e:#}");
                }
            }
            applied = state.ice_candidates.len();
        }
    });

    // ── Capture + encode task ────────────────────────────────────────
    // We own the capture driver in a blocking thread (X11 sync API) and
    // hand frames to the encoder sink through a bounded channel.
    // `frame_rx` is moved (consumed) by encoder::spawn below — no `mut`
    // needed at this binding because ownership transfer is the mutation.
    let (frame_tx, frame_rx) = tokio::sync::mpsc::channel::<capture::Frame>(2);

    // Capture task — blocking, runs on a dedicated thread.
    let capture_handle = tokio::task::spawn_blocking(move || -> Result<()> {
        let mut driver = match capture::default_driver() {
            Ok(d) => d,
            Err(e) => {
                // Most common cause: agent runs as a system daemon with
                // no DISPLAY/XAUTHORITY env, so xcap can't open the X
                // server. Logging at error level (not silently dying)
                // means `journalctl -u glanus-agent` shows exactly why
                // the viewer sees a black screen.
                log::error!(
                    "remote_desktop: failed to initialise capture driver — \
                     no video will be sent to the viewer. Cause: {e:#}. \
                     If running under systemd as a system service, ensure \
                     DISPLAY and XAUTHORITY are exported in the unit so \
                     X11 capture can attach to the active session."
                );
                return Err(e);
            }
        };
        log::info!("remote_desktop: capture driver = {}", driver.name());
        // Capture-side counters — paired with the encoder stats so we can
        // tell the difference between "screen not being captured" and
        // "captured frames not making it into RTP".
        let mut cap_ok: u64 = 0;
        let mut cap_err: u64 = 0;
        let mut cap_dropped: u64 = 0;
        let mut last_log = std::time::Instant::now();
        loop {
            let frame = match driver.capture() {
                Ok(f) => {
                    cap_ok += 1;
                    f
                }
                Err(e) => {
                    cap_err += 1;
                    log::warn!("remote_desktop: capture error: {e:#}");
                    std::thread::sleep(FRAME_INTERVAL);
                    continue;
                }
            };
            // Non-blocking send — drop the frame if the encoder is behind,
            // which is the correct backpressure strategy for realtime video.
            match frame_tx.try_send(frame) {
                Ok(()) => {}
                Err(tokio::sync::mpsc::error::TrySendError::Full(_)) => {
                    cap_dropped += 1;
                }
                Err(tokio::sync::mpsc::error::TrySendError::Closed(_)) => break,
            }
            if last_log.elapsed() >= std::time::Duration::from_secs(5) {
                log::info!(
                    "remote_desktop: capture stats — ok={} err={} dropped={}",
                    cap_ok, cap_err, cap_dropped
                );
                cap_ok = 0;
                cap_err = 0;
                cap_dropped = 0;
                last_log = std::time::Instant::now();
            }
            std::thread::sleep(FRAME_INTERVAL);
        }
        Ok(())
    });

    // Encoder sink task — VP8 via libvpx, pushes samples directly onto
    // the outbound video track so webrtc-rs handles RTP packetisation.
    let encoder_handle = encoder::spawn(frame_rx, peer.video_track(), peer.force_keyframe.clone());

    // ── Main event loop: pump PeerEvents into the signaling client ──
    let mut final_status: Option<&'static str> = None;
    while let Some(event) = peer.events.recv().await {
        match event {
            PeerEvent::LocalAnswer(answer) => {
                if let Err(e) = signaling.send_answer(&id, &answer).await {
                    log::warn!("remote_desktop: send_answer failed: {e:#}");
                }
            }
            PeerEvent::LocalIceCandidate(candidate) => {
                if let Err(e) = signaling.send_ice_candidate(&id, &candidate).await {
                    log::debug!("remote_desktop: send_ice_candidate failed: {e:#}");
                }
            }
            PeerEvent::Closed => {
                log::info!("remote_desktop: peer closed, tearing down session {id}");
                // If we never reached a connected state, report FAILED so
                // the backend drops this session from ACTIVE. Otherwise
                // report ENDED for a clean shutdown. Either way the
                // session must leave ACTIVE, else the idempotent create
                // path will keep handing this dead id back to the user.
                final_status = Some(if peer.ever_connected() { "ENDED" } else { "FAILED" });
                break;
            }
        }
    }

    capture_handle.abort();
    encoder_handle.abort();
    ice_poll_handle.abort();
    peer.close().await;

    if let Some(status) = final_status {
        if let Err(e) = signaling.send_status(&id, status).await {
            log::warn!("remote_desktop: failed to mark session {id} as {status}: {e:#}");
        }
    }
    Ok(())
}
