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
    pub asset_id: Option<String>,
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
                asset_id: None,
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
    fn bundled_config_candidates() -> Vec<PathBuf> {
        let mut candidates = Vec::new();

        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(exe_dir) = current_exe.parent() {
                candidates.push(exe_dir.join("config").join("config.toml"));
                candidates.push(exe_dir.join("config.toml"));

                #[cfg(target_os = "macos")]
                {
                    if let Some(contents_dir) = exe_dir.parent() {
                        candidates.push(contents_dir.join("Resources").join("config.toml"));
                    }
                }
            }
        }

        candidates
    }

    /// Get the config file path based on OS.
    ///
    /// On Linux the system-wide path `/var/lib/glanus-agent/config.toml` is
    /// preferred so the systemd daemon (running as root) and the install
    /// script agree on a single location. If that directory is not writable
    /// (e.g. an unprivileged user launching the GUI), we fall back to the
    /// per-user XDG config dir (`~/.config/glanus/config.toml`).
    pub fn config_path() -> Result<PathBuf> {
        #[cfg(target_os = "linux")]
        {
            const SYSTEM_DIR: &str = "/var/lib/glanus-agent";
            let system_path = PathBuf::from(SYSTEM_DIR).join("config.toml");

            // Prefer the system path if the directory already exists AND is
            // writable by the current user, OR we're running as root and can
            // create it.
            let system_usable = match std::fs::metadata(SYSTEM_DIR) {
                Ok(meta) if meta.is_dir() => {
                    // Try a write probe via open+append on a temp file
                    let probe = PathBuf::from(SYSTEM_DIR).join(".glanus-write-probe");
                    match std::fs::OpenOptions::new().create(true).write(true).truncate(true).open(&probe) {
                        Ok(_) => { let _ = std::fs::remove_file(&probe); true }
                        Err(_) => false,
                    }
                }
                _ => {
                    // Directory doesn't exist: try to create it (works only as root)
                    std::fs::create_dir_all(SYSTEM_DIR).is_ok()
                }
            };

            if system_usable {
                return Ok(system_path);
            }

            // Fallback: per-user config dir for unprivileged GUI sessions
            let user_dir = dirs::config_dir()
                .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?
                .join("glanus");
            std::fs::create_dir_all(&user_dir)?;
            return Ok(user_dir.join("config.toml"));
        }

        #[cfg(not(target_os = "linux"))]
        {
            if cfg!(target_os = "macos") {
                const SYSTEM_DIR: &str = "/Library/Application Support/Glanus";
                let system_path = PathBuf::from(SYSTEM_DIR).join("config.toml");
                let system_usable = match std::fs::metadata(SYSTEM_DIR) {
                    Ok(meta) if meta.is_dir() => {
                        let probe = PathBuf::from(SYSTEM_DIR).join(".glanus-write-probe");
                        match std::fs::OpenOptions::new().create(true).write(true).truncate(true).open(&probe) {
                            Ok(_) => { let _ = std::fs::remove_file(&probe); true }
                            Err(_) => false,
                        }
                    }
                    _ => std::fs::create_dir_all(SYSTEM_DIR).is_ok()
                };

                if system_usable {
                    return Ok(system_path);
                }

                let user_dir = dirs::home_dir()
                    .ok_or_else(|| anyhow::anyhow!("Could not find home directory"))?
                    .join("Library/Application Support/Glanus");
                std::fs::create_dir_all(&user_dir)?;
                return Ok(user_dir.join("config.toml"));
            } else {
                // Windows
                // Use ProgramData for system-wide configuration
                let program_data = std::env::var("ProgramData")
                    .unwrap_or_else(|_| "C:\\ProgramData".to_string());
                let system_dir = PathBuf::from(program_data).join("Glanus");
                let system_path = system_dir.join("config.toml");
                
                let system_usable = match std::fs::metadata(&system_dir) {
                    Ok(meta) if meta.is_dir() => {
                        let probe = system_dir.join(".glanus-write-probe");
                        match std::fs::OpenOptions::new().create(true).write(true).truncate(true).open(&probe) {
                            Ok(_) => { let _ = std::fs::remove_file(&probe); true }
                            Err(_) => false,
                        }
                    }
                    _ => std::fs::create_dir_all(&system_dir).is_ok()
                };

                if system_usable {
                    return Ok(system_path);
                }

                let user_dir = dirs::config_dir()
                    .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?
                    .join("Glanus");
                std::fs::create_dir_all(&user_dir)?;
                return Ok(user_dir.join("config.toml"));
            }
        }
    }

    /// Load config from file or create default
    pub fn load() -> Result<Self> {
        let path = Self::config_path()?;
        
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            let config: Self = toml::from_str(&content)?;
            Ok(config)
        } else {
            for candidate in Self::bundled_config_candidates() {
                if candidate.exists() {
                    std::fs::copy(&candidate, &path)?;
                    let content = std::fs::read_to_string(&path)?;
                    let config: Self = toml::from_str(&content)?;
                    return Ok(config);
                }
            }

            // Create default config
            let config = Self::default();
            config.save()?;
            Ok(config)
        }
    }

    /// Save config to file with restrictive permissions (0600 on Unix)
    pub fn save(&self) -> Result<()> {
        let path = Self::config_path()?;
        let content = toml::to_string_pretty(self)?;
        std::fs::write(&path, content)?;

        // Restrict file permissions to owner-only on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
        }

        Ok(())
    }
}

// Add dirs crate for cross-platform directory paths
