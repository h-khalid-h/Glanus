//! Signaling transport for the remote-desktop host.
//!
//! The agent is a *pull* client: it polls a lightweight endpoint for the
//! active session (if any), then pushes the WebRTC answer and ICE candidates
//! back via the existing `/api/remote/sessions/:id/signaling` route used by
//! the browser viewer.
//!
//! This module owns no state — it is a thin, well-typed HTTP shim. The caller
//! (`runtime`) drives the loop and wires session lifecycle.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Session descriptor returned by `GET /api/agent/remote/active`.
///
/// Fields are loose (`serde_json::Value`) because the backend serializes
/// WebRTC SDP/ICE as Prisma `Json` columns; strict typing would couple us
/// to a specific wire shape the frontend also negotiates.
#[derive(Debug, Clone, Deserialize)]
pub struct ActiveSession {
    pub id: String,
    #[serde(default)]
    pub offer: Option<Value>,
    // Prisma serializes an empty `Json` column as `null`, not `[]`, so we
    // must accept both. `deserialize_with` normalises any non-array value
    // (null, missing, wrong type) into an empty vec.
    #[serde(
        rename = "iceCandidates",
        default,
        deserialize_with = "deserialize_null_as_empty_vec"
    )]
    pub ice_candidates: Vec<Value>,
    /// Backend-authoritative read-only flag. When true, the runtime swaps
    /// the platform input driver for the no-op driver so input events
    /// arriving on the data channel are silently discarded — even a
    /// compromised viewer cannot inject input. Defaults to false for
    /// backwards compatibility with older backends that do not send this
    /// field.
    #[serde(rename = "viewOnly", default)]
    pub view_only: bool,
}

fn deserialize_null_as_empty_vec<'de, D>(deserializer: D) -> Result<Vec<Value>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt: Option<Vec<Value>> = Option::deserialize(deserializer)?;
    Ok(opt.unwrap_or_default())
}

/// Full signaling state snapshot — returned by the user-facing signaling
/// GET endpoint. Used by the agent to poll for trickle-ICE candidates
/// the viewer pushes after the initial offer.
#[derive(Debug, Clone, Deserialize)]
pub struct SignalingState {
    pub status: String,
    #[serde(
        rename = "iceCandidates",
        default,
        deserialize_with = "deserialize_null_as_empty_vec"
    )]
    pub ice_candidates: Vec<Value>,
}

#[derive(Debug, Serialize)]
struct SignalingPatch<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    answer: Option<&'a Value>,
    #[serde(rename = "iceCandidate", skip_serializing_if = "Option::is_none")]
    ice_candidate: Option<&'a Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<&'a str>,
}


/// ICE server entry returned by `/api/remote/ice-servers`. Mirrors
/// `RTCIceServer`; `urls` may be a single string or an array — we accept
/// both via `untagged` deserialization.
#[derive(Debug, Clone, Deserialize)]
pub struct IceServerEntry {
    pub urls: UrlList,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub credential: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum UrlList {
    One(String),
    Many(Vec<String>),
}

impl UrlList {
    pub fn into_vec(self) -> Vec<String> {
        match self {
            UrlList::One(s) => vec![s],
            UrlList::Many(v) => v,
        }
    }
}

pub struct SignalingClient {
    http: Client,
    api_url: String,
    auth_token: String,
}

impl SignalingClient {
    pub fn new(api_url: String, auth_token: String) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("failed to build reqwest client"),
            api_url,
            auth_token,
        }
    }

    /// Fetch the current active remote session for this agent, if any.
    ///
    /// The endpoint is already implemented at `/api/agent/remote/active` and
    /// authenticates via bearer token (see `AgentService.getActiveRemoteSession`).
    pub async fn fetch_active_session(&self) -> Result<Option<ActiveSession>> {
        let url = format!("{}/api/agent/remote/active", self.api_url);
        let resp = self
            .http
            .get(&url)
            .bearer_auth(&self.auth_token)
            .send()
            .await
            .context("signaling: fetch active session request failed")?;

        if !resp.status().is_success() {
            // 404 / 401 here are non-fatal — just means no session or token expired.
            return Ok(None);
        }

        #[derive(Deserialize)]
        struct Envelope {
            data: Option<EnvelopeData>,
        }
        #[derive(Deserialize)]
        struct EnvelopeData {
            session: Option<ActiveSession>,
        }

        let env: Envelope = resp
            .json()
            .await
            .context("signaling: malformed active-session payload")?;
        Ok(env.data.and_then(|d| d.session))
    }

    /// Push the local SDP answer back to the session.
    pub async fn send_answer(&self, session_id: &str, answer: &Value) -> Result<()> {
        self.patch(
            session_id,
            &SignalingPatch {
                answer: Some(answer),
                ice_candidate: None,
                status: None,
            },
        )
        .await
    }

    /// Push a single local ICE candidate.
    pub async fn send_ice_candidate(&self, session_id: &str, candidate: &Value) -> Result<()> {
        self.patch(
            session_id,
            &SignalingPatch {
                answer: None,
                ice_candidate: Some(candidate),
                status: None,
            },
        )
        .await
    }

    /// Transition the session status (e.g. to FAILED or ENDED) so the
    /// backend drops it from the active pool. Without this the session
    /// stays ACTIVE forever when our peer closes, the idempotent create
    /// path keeps handing the stale id back to the user, and our dedup
    /// slot never clears — leaving the session permanently wedged.
    pub async fn send_status(&self, session_id: &str, status: &str) -> Result<()> {
        self.patch(
            session_id,
            &SignalingPatch {
                answer: None,
                ice_candidate: None,
                status: Some(status),
            },
        )
        .await
    }

    /// Fetch the full signaling state for a session (used to poll for
    /// trickle-ICE candidates the viewer adds after the initial offer).
    pub async fn fetch_signaling_state(&self, session_id: &str) -> Result<SignalingState> {
        let url = format!(
            "{}/api/remote/sessions/{}/signaling",
            self.api_url, session_id
        );
        let resp = self
            .http
            .get(&url)
            .bearer_auth(&self.auth_token)
            .send()
            .await
            .context("signaling: fetch state request failed")?;
        if !resp.status().is_success() {
            anyhow::bail!("signaling: fetch state returned {}", resp.status());
        }
        #[derive(Deserialize)]
        struct Envelope {
            data: SignalingState,
        }
        let env: Envelope = resp
            .json()
            .await
            .context("signaling: malformed state payload")?;
        Ok(env.data)
    }


    /// Fetch the ICE server list (STUN + TURN) from the backend. Called
    /// once per session before constructing the peer connection. Returns
    /// an empty vec on failure so the caller can fall back to a default
    /// STUN-only configuration without aborting the session.
    pub async fn fetch_ice_servers(&self) -> Vec<IceServerEntry> {
        let url = format!("{}/api/remote/ice-servers", self.api_url);
        let resp = match self
            .http
            .get(&url)
            .bearer_auth(&self.auth_token)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => r,
            Ok(r) => {
                log::warn!("signaling: ice-servers HTTP {}", r.status());
                return Vec::new();
            }
            Err(e) => {
                log::warn!("signaling: ice-servers fetch failed: {e:#}");
                return Vec::new();
            }
        };
        #[derive(Deserialize)]
        struct Envelope { data: IceData }
        #[derive(Deserialize)]
        struct IceData { #[serde(rename = "iceServers")] ice_servers: Vec<IceServerEntry> }
        match resp.json::<Envelope>().await {
            Ok(e) => e.data.ice_servers,
            Err(e) => {
                log::warn!("signaling: malformed ice-servers payload: {e:#}");
                Vec::new()
            }
        }
    }

    async fn patch(&self, session_id: &str, body: &SignalingPatch<'_>) -> Result<()> {
        let url = format!(
            "{}/api/remote/sessions/{}/signaling",
            self.api_url, session_id
        );
        let resp = self
            .http
            .patch(&url)
            .bearer_auth(&self.auth_token)
            .json(body)
            .send()
            .await
            .context("signaling: patch request failed")?;
        if !resp.status().is_success() {
            anyhow::bail!("signaling: patch returned {}", resp.status());
        }
        Ok(())
    }
}
