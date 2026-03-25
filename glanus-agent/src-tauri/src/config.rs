// Configuration module for Glanus Agent
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub agent: AgentSettings,
    pub server: ServerSettings,
    #[serde(default)]
    pub monitoring: MonitoringSettings,
    #[serde(default)]
    pub updates: UpdateSettings,
    #[serde(default)]
    pub inventory: InventorySettings,
    #[serde(default)]
    pub discovery: DiscoverySettings,
    #[serde(default)]
    pub remote: RemoteSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSettings {
    pub version: String,
    pub workspace_id: Option<String>,
    pub pre_auth_token: Option<String>,
    pub registered: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerSettings {
    pub api_url: String,
    pub heartbeat_interval: u64, // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringSettings {
    pub enabled: bool,
    pub interval: u64, // seconds
    pub include_processes: bool,
    pub max_processes: usize,
}

impl Default for MonitoringSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            interval: 10,
            include_processes: true,
            max_processes: 5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSettings {
    pub enabled: bool,
    pub check_interval: u64, // seconds
    pub auto_install: bool,
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            check_interval: 86400,
            auto_install: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventorySettings {
    pub enabled: bool,
    pub sync_interval: u64, // seconds (default: 6 hours)
}

impl Default for InventorySettings {
    fn default() -> Self {
        Self {
            enabled: true,
            sync_interval: 21600, // 6 hours
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverySettings {
    pub enabled: bool,
    pub subnet: Option<String>,    // e.g. "192.168.1.0/24"
    pub scan_interval: u64,        // seconds (default: 1 hour)
}

impl Default for DiscoverySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            subnet: None,
            scan_interval: 3600, // 1 hour
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteSettings {
    pub enabled: bool,
}

impl Default for RemoteSettings {
    fn default() -> Self {
        Self {
            enabled: true,
        }
    }
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            agent: AgentSettings {
                version: env!("CARGO_PKG_VERSION").to_string(),
                workspace_id: None,
                pre_auth_token: None,
                registered: false,
            },
            server: ServerSettings {
                api_url: "https://api.glanus.com".to_string(),
                heartbeat_interval: 60,
            },
            monitoring: MonitoringSettings::default(),
            updates: UpdateSettings::default(),
            inventory: InventorySettings::default(),
            discovery: DiscoverySettings::default(),
            remote: RemoteSettings::default(),
        }
    }
}

impl AgentConfig {
    /// Get the config file path based on OS
    pub fn config_path() -> Result<PathBuf> {
        let config_dir = if cfg!(target_os = "macos") {
            dirs::home_dir()
                .ok_or_else(|| anyhow::anyhow!("Could not find home directory"))?
                .join("Library/Application Support/Glanus")
        } else if cfg!(target_os = "windows") {
            dirs::config_dir()
                .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?
                .join("Glanus")
        } else {
            // Linux
            dirs::config_dir()
                .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?
                .join("glanus")
        };

        std::fs::create_dir_all(&config_dir)?;
        Ok(config_dir.join("config.toml"))
    }

    /// Load config from file or create default
    pub fn load() -> Result<Self> {
        let path = Self::config_path()?;
        
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            let config: Self = toml::from_str(&content)?;
            Ok(config)
        } else {
            // Create default config
            let config = Self::default();
            config.save()?;
            Ok(config)
        }
    }

    /// Save config to file
    pub fn save(&self) -> Result<()> {
        let path = Self::config_path()?;
        let content = toml::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }
}

// Add dirs crate for cross-platform directory paths
