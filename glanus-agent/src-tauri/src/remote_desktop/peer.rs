//! WebRTC peer-connection glue.
//!
//! This module wraps `webrtc-rs` to turn a backend-provided SDP offer into a
//! live peer connection that:
//!
//!  * exposes a video track (filled by `capture` + the VP8 encoder in
//!    [`super::encoder`]),
//!  * receives an `"input"` data channel (fed to the `input` driver),
//!  * emits local ICE candidates back to the signaling layer.

use anyhow::{Context, Result};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use webrtc::api::interceptor_registry::register_default_interceptors;
use webrtc::api::media_engine::{MediaEngine, MIME_TYPE_VP8};
use webrtc::api::APIBuilder;
use webrtc::data_channel::data_channel_message::DataChannelMessage;
use webrtc::ice_transport::ice_candidate::RTCIceCandidateInit;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::interceptor::registry::Registry;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::peer_connection::RTCPeerConnection;
use webrtc::rtp_transceiver::rtp_codec::{RTCRtpCodecCapability, RTPCodecType};
use webrtc::track::track_local::track_local_static_sample::TrackLocalStaticSample;
use webrtc::track::track_local::TrackLocal;

use super::input::{InputControl, InputEvent};

/// Output events emitted by the peer connection back to the runtime.
#[derive(Debug)]
pub enum PeerEvent {
    /// Locally produced ICE candidate — forward to `SignalingClient::send_ice_candidate`.
    LocalIceCandidate(Value),
    /// SDP answer ready — forward to `SignalingClient::send_answer`.
    LocalAnswer(Value),
    /// Connection closed / failed.
    Closed,
}

pub struct PeerSession {
    pc: Arc<RTCPeerConnection>,
    pub events: mpsc::UnboundedReceiver<PeerEvent>,
    /// Flipped to true the first time the peer connection reaches
    /// `Connected`. Used by the runtime to decide whether a closed session
    /// should be marked ENDED (clean) or FAILED (never connected).
    connected_once: Arc<std::sync::atomic::AtomicBool>,
    /// Track handle kept alive for the duration of the session.
    _video_track: Arc<TrackLocalStaticSample>,
}

impl PeerSession {
    /// Build a peer connection, apply the remote offer, and return the local
    /// answer + a receiver of lifecycle events. ICE candidates produced
    /// locally will be emitted via `PeerEvent::LocalIceCandidate`.
    pub async fn accept_offer(
        offer: RTCSessionDescription,
        mut input_driver: Box<dyn InputControl>,
        ice_servers: Vec<RTCIceServer>,
    ) -> Result<Self> {
        let mut me = MediaEngine::default();
        me.register_default_codecs()
            .context("webrtc: register_default_codecs failed")?;
        let registry = register_default_interceptors(Registry::new(), &mut me)
            .context("webrtc: register_default_interceptors failed")?;
        let api = APIBuilder::new()
            .with_media_engine(me)
            .with_interceptor_registry(registry)
            .build();

        // ICE servers are provided by the runtime — typically a STUN list
        // plus one TURN entry resolved from `/api/remote/ice-servers`.
        // Falling back to Google STUN keeps LAN/dev environments working
        // when the backend has no TURN configured.
        let ice_servers = if ice_servers.is_empty() {
            vec![RTCIceServer {
                urls: vec!["stun:stun.l.google.com:19302".to_owned()],
                ..Default::default()
            }]
        } else {
            ice_servers
        };
        let config = RTCConfiguration {
            ice_servers,
            ..Default::default()
        };

        let pc = Arc::new(
            api.new_peer_connection(config)
                .await
                .context("webrtc: new_peer_connection failed")?,
        );

        // ── Video track ────────────────────────────────────────────────────
        // NOTE: we only construct the track here. Binding it to a transceiver
        // happens AFTER `set_remote_description`, so the m-line ordering in
        // our answer matches the offer exactly. Adding tracks up-front made
        // webrtc-rs prepend an extra `video` m-line that didn't exist in the
        // offer, tripping Chrome's "The order of m-lines in answer doesn't
        // match order in offer" guard.
        let video_track = Arc::new(TrackLocalStaticSample::new(
            RTCRtpCodecCapability {
                mime_type: MIME_TYPE_VP8.to_owned(),
                ..Default::default()
            },
            "video".to_owned(),
            "glanus-agent".to_owned(),
        ));

        // ── Event plumbing ────────────────────────────────────────────────
        let (tx, rx) = mpsc::unbounded_channel::<PeerEvent>();

        let tx_ice = tx.clone();
        pc.on_ice_candidate(Box::new(move |candidate| {
            let tx_ice = tx_ice.clone();
            Box::pin(async move {
                if let Some(c) = candidate {
                    match c.to_json() {
                        Ok(json) => {
                            // webrtc-rs serialises `sdp_mid` (snake_case) but
                            // the browser's RTCIceCandidateInit requires
                            // `sdpMid` (camelCase). Rebuild the wire object
                            // by hand so the backend stores the exact shape
                            // the viewer will hand to `addIceCandidate`.
                            let wire = serde_json::json!({
                                "candidate": json.candidate,
                                "sdpMid": json.sdp_mid,
                                "sdpMLineIndex": json.sdp_mline_index,
                            });
                            let _ = tx_ice.send(PeerEvent::LocalIceCandidate(wire));
                        }
                        Err(e) => log::warn!("webrtc: candidate.to_json failed: {e}"),
                    }
                }
            })
        }));

        let tx_close = tx.clone();
        let connected_once = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let connected_flag = connected_once.clone();
        // Watchdog handle for the `Disconnected` recovery window. The W3C
        // RTCPeerConnection state machine treats `Disconnected` as
        // *recoverable* — ICE may re-establish on its own (e.g. brief
        // network blip, NIC switch, NAT rebinding). We give it a grace
        // window before giving up; if the state returns to Connected
        // within the window we cancel the watchdog and keep streaming.
        let disconnected_watchdog: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>> =
            Arc::new(Mutex::new(None));
        let watchdog_slot = disconnected_watchdog.clone();
        pc.on_peer_connection_state_change(Box::new(move |state| {
            let tx_close = tx_close.clone();
            let connected_flag = connected_flag.clone();
            let watchdog_slot = watchdog_slot.clone();
            Box::pin(async move {
                use webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
                log::info!("remote_desktop: peer state -> {state}");

                // Cancel any pending Disconnected watchdog whenever we
                // leave the Disconnected state — both for recovery
                // (Connected) and terminal transitions (Failed/Closed,
                // which we handle below directly).
                if !matches!(state, RTCPeerConnectionState::Disconnected) {
                    let mut slot = watchdog_slot.lock().await;
                    if let Some(h) = slot.take() {
                        h.abort();
                    }
                }

                if matches!(state, RTCPeerConnectionState::Connected) {
                    connected_flag.store(true, std::sync::atomic::Ordering::SeqCst);
                    return;
                }

                if matches!(
                    state,
                    RTCPeerConnectionState::Failed | RTCPeerConnectionState::Closed
                ) {
                    // Terminal — tear down the session.
                    let _ = tx_close.send(PeerEvent::Closed);
                    return;
                }

                if matches!(state, RTCPeerConnectionState::Disconnected) {
                    // Recoverable. Start a watchdog: if we're still
                    // Disconnected after DISCONNECTED_GRACE, escalate to
                    // Closed. The ICE agent inside webrtc-rs will keep
                    // probing in the meantime, so a fast recovery is
                    // observed via the next state change which cancels
                    // this task.
                    const DISCONNECTED_GRACE: std::time::Duration =
                        std::time::Duration::from_secs(20);
                    let mut slot = watchdog_slot.lock().await;
                    if slot.is_some() {
                        return; // watchdog already armed
                    }
                    let tx_close = tx_close.clone();
                    let handle = tokio::spawn(async move {
                        tokio::time::sleep(DISCONNECTED_GRACE).await;
                        log::warn!(
                            "remote_desktop: peer remained Disconnected past grace window, closing"
                        );
                        let _ = tx_close.send(PeerEvent::Closed);
                    });
                    *slot = Some(handle);
                }
            })
        }));

        // ── Data channel for input ────────────────────────────────────────
        // The viewer creates the "input" data channel and we receive it via
        // on_data_channel. To avoid sending the `!Sync` input driver into the
        // webrtc callback, we spawn a dedicated task that owns the driver and
        // consumes events from a channel.
        let (input_tx, mut input_rx) = mpsc::unbounded_channel::<InputEvent>();
        tokio::spawn(async move {
            while let Some(ev) = input_rx.recv().await {
                if let Err(e) = input_driver.handle(ev) {
                    log::warn!("remote_desktop: input handler error: {e:#}");
                }
            }
        });

        pc.on_data_channel(Box::new(move |dc| {
            let input_tx = input_tx.clone();
            Box::pin(async move {
                let label = dc.label().to_owned();
                log::info!("remote_desktop: data channel opened (label={label})");
                if label != "input" {
                    // Future-proofing: only the "input" channel is wired
                    // to the input driver. We still log + accept the
                    // channel so SCTP negotiation completes cleanly on
                    // the viewer side (simple-peer waits for 'open'
                    // before firing its 'connect' event).
                    return;
                }
                dc.on_message(Box::new(move |msg: DataChannelMessage| {
                    let input_tx = input_tx.clone();
                    Box::pin(async move {
                        match serde_json::from_slice::<InputEvent>(&msg.data) {
                            Ok(ev) => {
                                let _ = input_tx.send(ev);
                            }
                            Err(e) => {
                                log::debug!("remote_desktop: drop malformed input event: {e}");
                            }
                        }
                    })
                }));
            })
        }));

        // ── SDP negotiation ──────────────────────────────────────────────
        pc.set_remote_description(offer)
            .await
            .context("webrtc: set_remote_description failed")?;

        // Now that the remote description is applied, webrtc-rs has a
        // transceiver for the video m-line the browser advertised
        // (recvonly on their side → sendonly on ours). Attach our outbound
        // video track to that existing transceiver's sender. This keeps
        // the m-line order identical to the offer, which is what Chrome
        // enforces.
        let mut bound = false;
        for tr in pc.get_transceivers().await {
            if tr.kind() == RTPCodecType::Video {
                if let Err(e) = tr
                    .sender()
                    .await
                    .replace_track(Some(video_track.clone() as Arc<dyn TrackLocal + Send + Sync>))
                    .await
                {
                    log::warn!("webrtc: replace_track on video transceiver failed: {e:#}");
                } else {
                    bound = true;
                }
                break;
            }
        }
        if !bound {
            log::warn!(
                "webrtc: offer had no video m-line; agent will connect but send no frames"
            );
        }

        let answer = pc
            .create_answer(None)
            .await
            .context("webrtc: create_answer failed")?;
        pc.set_local_description(answer.clone())
            .await
            .context("webrtc: set_local_description failed")?;

        // Emit the answer via the event channel so runtime can forward it.
        if let Ok(val) = serde_json::to_value(&answer) {
            let _ = tx.send(PeerEvent::LocalAnswer(val));
        }

        Ok(Self {
            pc,
            events: rx,
            connected_once,
            _video_track: video_track,
        })
    }

    /// Feed a remote ICE candidate (from the viewer) into the connection.
    pub async fn add_remote_ice(&self, candidate: Value) -> Result<()> {
        // The browser may send candidates as `{candidate, sdpMid, sdpMLineIndex}`
        // or as full RTCIceCandidate. `RTCIceCandidateInit` deserialises both.
        let init: RTCIceCandidateInit = serde_json::from_value(candidate)
            .context("webrtc: malformed remote ICE candidate")?;
        self.pc
            .add_ice_candidate(init)
            .await
            .context("webrtc: add_ice_candidate failed")?;
        Ok(())
    }

    /// Cheap cloneable handle that exposes only the operations safe to run
    /// concurrently with the main event loop (e.g. trickle-ICE from a
    /// sibling poller task).
    pub fn ice_handle(&self) -> IceHandle {
        IceHandle { pc: self.pc.clone() }
    }

    /// Handle to the outbound video track. The encoder task calls
    /// `write_sample` on this to push VP8 frames to the viewer.
    pub fn video_track(&self) -> Arc<TrackLocalStaticSample> {
        self._video_track.clone()
    }

    /// True if the peer ever reached `Connected`. Used to classify the
    /// terminal session status as ENDED (clean) vs FAILED (never
    /// succeeded).
    pub fn ever_connected(&self) -> bool {
        self.connected_once.load(std::sync::atomic::Ordering::SeqCst)
    }

    pub async fn close(self) {
        if let Err(e) = self.pc.close().await {
            log::warn!("webrtc: close failed: {e:#}");
        }
    }
}

#[derive(Clone)]
pub struct IceHandle {
    pc: Arc<RTCPeerConnection>,
}

impl IceHandle {
    pub async fn add_remote_ice(&self, candidate: Value) -> Result<()> {
        let init: RTCIceCandidateInit = serde_json::from_value(candidate)
            .context("webrtc: malformed remote ICE candidate")?;
        self.pc
            .add_ice_candidate(init)
            .await
            .context("webrtc: add_ice_candidate failed")?;
        Ok(())
    }
}
