// HTTP Client for Glanus Backend Communication
use anyhow::{Result, Context};
use base64::Engine;
use reqwest::{Certificate, Client};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Error indicating the agent's auth token has been rejected (HTTP 401).
/// Callers should trigger re-registration when this is returned.
#[derive(Debug, thiserror::Error)]
#[error("Agent authentication rejected (HTTP 401) — re-registration required")]
pub struct AuthRejectedError;

// ============================================
// Shared API response envelope
// ============================================

/// Standard wrapper returned by every Glanus platform endpoint:
/// `{ success: bool, data: T, meta: { timestamp: String } }`
#[derive(Debug, Deserialize)]
pub struct ApiResponse<T> {
    /// Server's success flag. Carried for completeness even when callers
    /// only consume `data` — surfacing the field still helps when
    /// debug-printing responses or matching against future error wrappers.
    #[allow(dead_code)]
    pub success: bool,
    pub data: T,
}

// ============================================
// Registration types
// ============================================

#[derive(Debug, Serialize)]
pub struct RegisterRequest {
    #[serde(rename = "assetId", skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub hostname: String,
    pub platform: String,
    #[serde(rename = "ipAddress")]
    pub ip_address: String,
    #[serde(rename = "agentVersion")]
    pub agent_version: String,
    #[serde(rename = "systemInfo")]
    pub system_info: SystemInfo,
}

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub cpu: String,
    pub ram: u64,  // GB
    pub disk: u64, // GB
    pub os: String,
}

/// Matches platform's `AgentService.registerAgent()` return shape.
#[derive(Debug, Deserialize)]
pub struct RegisterResponseData {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "assetId")]
    pub asset_id: String,
    #[serde(rename = "authToken")]
    pub auth_token: String,
}

// ============================================
// Heartbeat types
// ============================================

#[derive(Debug, Serialize)]
pub struct HeartbeatRequest {
    #[serde(rename = "authToken")]
    pub auth_token: String,
    pub metrics: HeartbeatMetrics,
    /// Agent-reported runtime capabilities. Backend uses this to decide
    /// whether the UI should offer actions like remote desktop on this host.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<AgentCapabilities>,
}

/// Feature-flag driven capability report. Every field is a boolean so new
/// capabilities can be added without breaking older backends (unknown fields
/// are simply ignored by the server-side Zod schema).
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCapabilities {
    /// True when the agent was built with `--features remote_desktop` and has
    /// a working screen-capture + input-injection path on this OS.
    pub remote_desktop: bool,
}

#[derive(Debug, Serialize)]
pub struct HeartbeatMetrics {
    pub cpu: f32,
    pub ram: f32,
    pub disk: f32,
    #[serde(rename = "cpuTemp")]
    pub cpu_temp: Option<f32>,
    #[serde(rename = "ramUsed")]
    pub ram_used: f32,
    #[serde(rename = "ramTotal")]
    pub ram_total: f32,
    #[serde(rename = "diskUsed")]
    pub disk_used: f32,
    #[serde(rename = "diskTotal")]
    pub disk_total: f32,
    #[serde(rename = "networkUp")]
    pub network_up: f32,
    #[serde(rename = "networkDown")]
    pub network_down: f32,
    #[serde(rename = "topProcesses")]
    pub top_processes: Vec<ProcessInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub name: String,
    pub cpu: f32,
    pub ram: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
}

/// Matches platform's heartbeat response: `{ status, agentId, commands }`
#[derive(Debug, Deserialize)]
pub struct HeartbeatResponseData {
    pub commands: Vec<Command>,
}

/// Matches platform's command shape from `AgentService.processHeartbeat()`.
#[derive(Debug, Clone, Deserialize)]
pub struct Command {
    pub id: String,
    /// Future router key. Currently unused by the executor (which only
    /// looks at `language`), but the platform sends it on every command
    /// and we want to keep the field for diagnostics.
    #[allow(dead_code)]
    #[serde(rename = "type")]
    pub command_type: String,
    #[serde(rename = "scriptName")]
    pub script_name: String,
    pub script: String,
    pub language: String,
    pub signature: Option<String>,
    #[serde(rename = "issuedAt")]
    pub issued_at: Option<String>,
}

// ============================================
// Command result types
// ============================================

#[derive(Debug, Serialize)]
pub struct CommandResultRequest {
    #[serde(rename = "authToken")]
    pub auth_token: String,
    #[serde(rename = "executionId")]
    pub execution_id: String,
    pub success: bool,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    #[serde(rename = "startedAt")]
    pub started_at: u64,
    #[serde(rename = "finishedAt")]
    pub finished_at: u64,
}

// ============================================
// Software inventory types
// ============================================

#[derive(Debug, Serialize)]
pub struct SoftwareInventoryRequest {
    #[serde(rename = "authToken")]
    pub auth_token: String,
    pub software: Vec<SoftwareItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SoftwareItem {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publisher: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "installDate")]
    pub install_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "sizeMB")]
    pub size_mb: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct SoftwareInventoryResponseData {
    pub count: usize,
}

// ============================================
// Network discovery types
// ============================================

#[derive(Debug, Serialize)]
pub struct DiscoveryRequest {
    #[serde(rename = "authToken")]
    pub auth_token: String,
    pub subnet: String,
    pub devices: Vec<DiscoveryDevice>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiscoveryDevice {
    #[serde(rename = "ipAddress")]
    pub ip_address: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "macAddress")]
    pub mac_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(rename = "deviceType")]
    pub device_type: String,
}

#[derive(Debug, Deserialize)]
pub struct DiscoveryResponseData {
    #[serde(rename = "scanId")]
    pub scan_id: String,
    pub count: usize,
}

// ============================================
// API Client
// ============================================

pub struct ApiClient {
    client: Client,
    base_url: String,
}

pub fn build_http_client(base_url: &str) -> Client {
    let is_release_runtime = !cfg!(debug_assertions);

    // Allow plaintext HTTP for localhost/loopback addresses even in release builds,
    // so developers and self-hosted setups can run without TLS termination.
    let lower = base_url.to_lowercase();
    let is_loopback = lower.starts_with("http://localhost")
        || lower.starts_with("http://127.")
        || lower.starts_with("http://[::1]")
        || lower.starts_with("http://0.0.0.0");
    let allow_plaintext = std::env::var("GLANUS_ALLOW_HTTP")
        .map(|v| matches!(v.as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);

    if is_release_runtime
        && !lower.starts_with("https://")
        && !is_loopback
        && !allow_plaintext
    {
        panic!("Refusing non-HTTPS API URL in release: {}", base_url);
    }

    let enforce_https = is_release_runtime && !is_loopback && !allow_plaintext;

    let mut builder = Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(10))
        .tcp_keepalive(Duration::from_secs(30))
        .https_only(enforce_https);

    if let Ok(ca_pem_b64) = std::env::var("GLANUS_PINNED_CA_PEM_BASE64") {
        match base64::engine::general_purpose::STANDARD.decode(ca_pem_b64.trim()) {
            Ok(pem_bytes) => match Certificate::from_pem(&pem_bytes) {
                Ok(ca_cert) => {
                    builder = builder
                        .tls_built_in_root_certs(false)
                        .add_root_certificate(ca_cert);
                }
                Err(e) => {
                    panic!("Invalid GLANUS_PINNED_CA_PEM_BASE64 certificate: {}", e);
                }
            },
            Err(e) => {
                panic!("Failed to decode GLANUS_PINNED_CA_PEM_BASE64: {}", e);
            }
        }
    } else if is_release_runtime {
        log::warn!("GLANUS_PINNED_CA_PEM_BASE64 is not configured; TLS pinning is disabled");
    }

    builder.build().expect("Failed to create HTTP client")
}

impl ApiClient {
    pub fn new(base_url: String) -> Self {
        let client = build_http_client(&base_url);
        Self { client, base_url }
    }

    /// Register agent with backend.
    /// The platform requires a logged-in user session (NextAuth cookie).
    /// The `pre_auth_token` is sent as a Bearer header for workspace access verification.
    pub async fn register(&self, request: RegisterRequest, pre_auth_token: &str) -> Result<RegisterResponseData> {
        let url = format!("{}/api/agent/register", self.base_url);

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", pre_auth_token))
            .json(&request)
            .send()
            .await
            .context("Failed to send registration request")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Registration failed with status {}: {}", status, error_text);
        }

        let envelope = response.json::<ApiResponse<RegisterResponseData>>()
            .await
            .context("Failed to parse registration response")?;

        Ok(envelope.data)
    }

    /// Send heartbeat to backend.
    /// Returns `AuthRejectedError` on HTTP 401 so callers can trigger re-registration.
    pub async fn heartbeat(&self, request: HeartbeatRequest) -> Result<HeartbeatResponseData> {
        let url = format!("{}/api/agent/heartbeat", self.base_url);

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .context("Failed to send heartbeat request")?;

        if !response.status().is_success() {
            let status = response.status();
            if status.as_u16() == 401 {
                return Err(AuthRejectedError.into());
            }
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Heartbeat failed with status {}: {}", status, error_text);
        }

        let envelope = response.json::<ApiResponse<HeartbeatResponseData>>()
            .await
            .context("Failed to parse heartbeat response")?;

        Ok(envelope.data)
    }

    /// Report command execution result.
    /// Returns `AuthRejectedError` on HTTP 401 so callers can trigger re-registration.
    pub async fn report_command_result(&self, request: CommandResultRequest) -> Result<()> {
        let url = format!("{}/api/agent/command-result", self.base_url);

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .context("Failed to send command result")?;

        if !response.status().is_success() {
            let status = response.status();
            if status.as_u16() == 401 {
                return Err(AuthRejectedError.into());
            }
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Command result reporting failed with status {}: {}", status, error_text);
        }

        Ok(())
    }

    /// Sync software inventory with backend.
    /// Returns `AuthRejectedError` on HTTP 401 so callers can trigger re-registration.
    pub async fn sync_software(&self, request: SoftwareInventoryRequest) -> Result<SoftwareInventoryResponseData> {
        let url = format!("{}/api/agent/software", self.base_url);

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .context("Failed to send software inventory")?;

        if !response.status().is_success() {
            let status = response.status();
            if status.as_u16() == 401 {
                return Err(AuthRejectedError.into());
            }
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Software sync failed with status {}: {}", status, error_text);
        }

        let envelope = response.json::<ApiResponse<SoftwareInventoryResponseData>>()
            .await
            .context("Failed to parse software sync response")?;

        Ok(envelope.data)
    }

    /// Submit network discovery results to backend.
    /// Returns `AuthRejectedError` on HTTP 401 so callers can trigger re-registration.
    pub async fn submit_discovery(&self, request: DiscoveryRequest) -> Result<DiscoveryResponseData> {
        let url = format!("{}/api/agent/discovery", self.base_url);

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .context("Failed to send discovery results")?;

        if !response.status().is_success() {
            let status = response.status();
            if status.as_u16() == 401 {
                return Err(AuthRejectedError.into());
            }
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Discovery submission failed with status {}: {}", status, error_text);
        }

        let envelope = response.json::<ApiResponse<DiscoveryResponseData>>()
            .await
            .context("Failed to parse discovery response")?;

        Ok(envelope.data)
    }
}

/// Get system hostname
pub fn get_hostname() -> String {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Get platform string (WINDOWS, MACOS, LINUX)
pub fn get_platform() -> String {
    if cfg!(target_os = "windows") {
        "WINDOWS".to_string()
    } else if cfg!(target_os = "macos") {
        "MACOS".to_string()
    } else {
        "LINUX".to_string()
    }
}

/// Get OS name and version
pub fn get_os_info() -> String {
    sysinfo::System::long_os_version()
        .unwrap_or_else(|| std::env::consts::OS.to_string())
}

/// Get local IP address (best effort)
pub fn get_local_ip() -> String {
    local_ip_address::local_ip()
        .ok()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string())
}
