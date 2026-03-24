// HTTP Client for Glanus Backend Communication
use anyhow::{Result, Context};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

// ============================================
// Shared API response envelope
// ============================================

/// Standard wrapper returned by every Glanus platform endpoint:
/// `{ success: bool, data: T, meta: { timestamp: String } }`
#[derive(Debug, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: T,
}

// ============================================
// Registration types
// ============================================

#[derive(Debug, Serialize)]
pub struct RegisterRequest {
    #[serde(rename = "assetId")]
    pub asset_id: String,
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

/// Matches platform's command shape from `AgentService.processHeartbeat()`:
/// `{ type, id, scriptName, script, language }`
#[derive(Debug, Clone, Deserialize)]
pub struct Command {
    pub id: String,
    #[serde(rename = "type")]
    pub command_type: String,
    #[serde(rename = "scriptName")]
    pub script_name: String,
    pub script: String,
    pub language: String,
}

// ============================================
// Command result types
// ============================================

#[derive(Debug, Serialize)]
pub struct CommandResultRequest {
    #[serde(rename = "authToken")]
    pub auth_token: String,
    /// Maps to platform's `executionId` (this is the ScriptExecution ID)
    #[serde(rename = "executionId")]
    pub execution_id: String,
    /// Platform expects lowercase: "completed", "failed", "timeout"
    pub status: String,
    pub output: Option<String>,
    pub error: Option<String>,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    /// Execution duration in milliseconds
    pub duration: Option<u64>,
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

impl ApiClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

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

    /// Send heartbeat to backend
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
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Heartbeat failed with status {}: {}", status, error_text);
        }

        let envelope = response.json::<ApiResponse<HeartbeatResponseData>>()
            .await
            .context("Failed to parse heartbeat response")?;

        Ok(envelope.data)
    }

    /// Report command execution result
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
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Command result reporting failed with status {}: {}", status, error_text);
        }

        Ok(())
    }

    /// Sync software inventory with backend
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
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Software sync failed with status {}: {}", status, error_text);
        }

        let envelope = response.json::<ApiResponse<SoftwareInventoryResponseData>>()
            .await
            .context("Failed to parse software sync response")?;

        Ok(envelope.data)
    }

    /// Submit network discovery results to backend
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
