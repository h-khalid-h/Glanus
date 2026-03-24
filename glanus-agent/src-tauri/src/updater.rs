// Auto-updater module - checks for updates and installs them
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use reqwest::Client;
use chrono::Timelike;
use crate::client::ApiResponse;

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub download_url: String,
    pub checksum: String, // SHA-256 checksum
    pub release_notes: String,
    pub required: bool, // If true, update is mandatory
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateCheckRequest {
    pub current_version: String,
    pub platform: String,
}

pub struct AutoUpdater {
    api_url: String,
    client: Client,
}

impl AutoUpdater {
    pub fn new(api_url: String) -> Self {
        Self {
            api_url,
            client: Client::new(),
        }
    }

    /// Check if an update is available
    pub async fn check_for_updates(&self, current_version: &str) -> Result<Option<UpdateInfo>> {
        let platform = crate::client::get_platform();
        
        let request = UpdateCheckRequest {
            current_version: current_version.to_string(),
            platform,
        };

        let url = format!("{}/api/agent/check-update", self.api_url);
        
        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .context("Failed to check for updates")?;

        if !response.status().is_success() {
            anyhow::bail!("Update check failed with status: {}", response.status());
        }

        let envelope = response.json::<ApiResponse<Option<UpdateInfo>>>()
            .await
            .context("Failed to parse update response")?;

        Ok(envelope.data)
    }

    /// Download installer to temp directory
    pub async fn download_installer(&self, update_info: &UpdateInfo) -> Result<PathBuf> {
        log::info!("Downloading installer from: {}", update_info.download_url);

        let response = self.client
            .get(&update_info.download_url)
            .send()
            .await
            .context("Failed to download installer")?;

        if !response.status().is_success() {
            anyhow::bail!("Download failed with status: {}", response.status());
        }

        // Get installer bytes
        let bytes = response.bytes()
            .await
            .context("Failed to read installer bytes")?;

        // Verify checksum
        let calculated_checksum = self.calculate_checksum(&bytes);
        if calculated_checksum != update_info.checksum {
            anyhow::bail!(
                "Checksum mismatch! Expected: {}, Got: {}",
                update_info.checksum,
                calculated_checksum
            );
        }

        // Save to temp directory
        let temp_dir = std::env::temp_dir();
        let installer_filename = self.get_installer_filename(&update_info.version);
        let installer_path = temp_dir.join(installer_filename);

        std::fs::write(&installer_path, &bytes)
            .context("Failed to write installer to temp directory")?;

        log::info!("Installer downloaded to: {:?}", installer_path);

        Ok(installer_path)
    }

    /// Install update (platform-specific)
    pub async fn install_update(&self, installer_path: &PathBuf) -> Result<()> {
        log::info!("Installing update from: {:?}", installer_path);

        #[cfg(target_os = "windows")]
        {
            // Run MSI installer with /quiet flag
            let status = tokio::process::Command::new("msiexec")
                .args(&["/i", installer_path.to_str().unwrap(), "/quiet", "/qn"])
                .status()
                .await
                .context("Failed to run MSI installer")?;

            if !status.success() {
                anyhow::bail!("Installer failed with exit code: {:?}", status.code());
            }
        }

        #[cfg(target_os = "macos")]
        {
            // Run PKG installer with sudo
            let status = tokio::process::Command::new("sudo")
                .args(&["installer", "-pkg", installer_path.to_str().unwrap(), "-target", "/"])
                .status()
                .await
                .context("Failed to run PKG installer")?;

            if !status.success() {
                anyhow::bail!("Installer failed with exit code: {:?}", status.code());
            }
        }

        #[cfg(target_os = "linux")]
        {
            // Run DEB installer
            let status = tokio::process::Command::new("sudo")
                .args(&["dpkg", "-i", installer_path.to_str().unwrap()])
                .status()
                .await
                .context("Failed to run DEB installer")?;

            if !status.success() {
                anyhow::bail!("Installer failed with exit code: {:?}", status.code());
            }
        }

        log::info!("Update installed successfully");
        Ok(())
    }

    /// Calculate SHA-256 checksum
    fn calculate_checksum(&self, data: &[u8]) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    /// Get platform-specific installer filename
    fn get_installer_filename(&self, version: &str) -> String {
        #[cfg(target_os = "windows")]
        return format!("glanus-agent-{}.msi", version);

        #[cfg(target_os = "macos")]
        return format!("glanus-agent-{}.pkg", version);

        #[cfg(target_os = "linux")]
        return format!("glanus-agent-{}.deb", version);
    }

    /// Check if update should be installed (based on schedule)
    pub fn should_install_now(&self) -> bool {
        // Simple logic: install during low-usage hours (2-4 AM)
        let now = chrono::Local::now();
        let hour = now.hour();
        hour >= 2 && hour < 4
    }

    /// Perform full update check and install if available
    pub async fn check_and_install(&self, current_version: &str) -> Result<bool> {
        // Check for updates
        let update_info = match self.check_for_updates(current_version).await? {
            Some(info) => info,
            None => {
                log::info!("No updates available");
                return Ok(false);
            }
        };

        log::info!("Update available: {} -> {}", current_version, update_info.version);

        // Check if we should install now (unless required)
        if !update_info.required && !self.should_install_now() {
            log::info!("Update scheduled for later (maintenance window)");
            return Ok(false);
        }

        // Download installer
        let installer_path = self.download_installer(&update_info).await?;

        // Install update
        self.install_update(&installer_path).await?;

        // Cleanup installer
        if let Err(e) = std::fs::remove_file(&installer_path) {
            log::warn!("Failed to cleanup installer: {}", e);
        }

        log::info!("Update completed successfully");
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checksum_calculation() {
        let updater = AutoUpdater::new("http://localhost".to_string());
        let data = b"Hello, World!";
        let checksum = updater.calculate_checksum(data);
        
        // Known SHA-256 of "Hello, World!"
        assert_eq!(
            checksum,
            "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
        );
    }

    #[test]
    fn test_installer_filename() {
        let updater = AutoUpdater::new("http://localhost".to_string());
        let filename = updater.get_installer_filename("1.0.0");
        
        #[cfg(target_os = "windows")]
        assert_eq!(filename, "glanus-agent-1.0.0.msi");
        
        #[cfg(target_os = "macos")]
        assert_eq!(filename, "glanus-agent-1.0.0.pkg");
        
        #[cfg(target_os = "linux")]
        assert_eq!(filename, "glanus-agent-1.0.0.deb");
    }
}
