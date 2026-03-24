// Agent registration module
use anyhow::{Result, Context};
use crate::client::{ApiClient, RegisterRequest, SystemInfo, get_hostname, get_platform, get_local_ip, get_os_info};
use crate::config::AgentConfig;
use crate::storage::SecureStorage;
use sysinfo::System;

pub struct RegistrationManager {
    api_client: ApiClient,
}

impl RegistrationManager {
    pub fn new(api_url: String) -> Self {
        Self {
            api_client: ApiClient::new(api_url),
        }
    }

    /// Check if agent is already registered
    pub fn is_registered(config: &AgentConfig) -> bool {
        config.agent.registered && SecureStorage::get_token().ok().flatten().is_some()
    }

    /// Register agent with backend
    pub async fn register(&self, config: &AgentConfig, asset_id: String) -> Result<()> {
        // Validate config
        let workspace_id = config.agent.workspace_id.clone()
            .context("Workspace ID not configured")?;
        let pre_auth_token = config.agent.pre_auth_token.clone()
            .context("Pre-auth token not configured")?;

        // Gather system info
        let sys = System::new_all();
        let system_info = SystemInfo {
            cpu: Self::get_cpu_info(&sys),
            ram: (sys.total_memory() / 1_073_741_824) as u64, // Convert to GB
            disk: Self::get_total_disk_size() as u64,
            os: get_os_info(),
        };

        // Build registration request
        let request = RegisterRequest {
            asset_id: asset_id.clone(),
            workspace_id,
            hostname: get_hostname(),
            platform: get_platform(),
            ip_address: get_local_ip(),
            agent_version: config.agent.version.clone(),
            system_info,
        };

        // Send registration request
        let response = self.api_client.register(request, &pre_auth_token)
            .await
            .context("Failed to register with backend")?;

        // Store auth token securely
        SecureStorage::store_token(&response.auth_token)
            .context("Failed to store auth token")?;

        // Update config
        let mut updated_config = config.clone();
        updated_config.agent.registered = true;
        updated_config.agent.pre_auth_token = None; // Clear pre-auth token for security
        updated_config.save()
            .context("Failed to save updated config")?;

        log::info!("Agent registered successfully: {}", response.agent_id);
        Ok(())
    }

    /// Get CPU info string
    fn get_cpu_info(sys: &System) -> String {
        sys.cpus()
            .first()
            .map(|cpu| cpu.brand().to_string())
            .unwrap_or_else(|| "Unknown CPU".to_string())
    }

    /// Get total disk size in GB
    fn get_total_disk_size() -> f32 {
        use sysinfo::Disks;
        let disks = Disks::new_with_refreshed_list();
        let total_bytes: u64 = disks.iter().map(|d| d.total_space()).sum();
        total_bytes as f32 / 1_073_741_824.0
    }
}
