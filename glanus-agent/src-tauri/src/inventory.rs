// Inventory sync manager - periodically syncs software inventory with backend
use anyhow::{Result, Context};
use std::time::Duration;
use crate::client::{ApiClient, SoftwareInventoryRequest};
use crate::software;
use crate::storage::SecureStorage;

pub struct InventoryManager {
    api_client: ApiClient,
}

impl InventoryManager {
    pub fn new(api_url: String) -> Self {
        Self {
            api_client: ApiClient::new(api_url),
        }
    }

    /// Run software inventory sync loop (every `interval` seconds)
    pub async fn start_loop(&self, interval_secs: u64) -> Result<()> {
        let interval = Duration::from_secs(interval_secs);
        log::info!("Starting inventory sync loop with {}s interval", interval_secs);

        loop {
            tokio::time::sleep(interval).await;

            if let Err(e) = self.sync_software().await {
                log::error!("Software inventory sync failed: {}", e);
            }
        }
    }

    /// Collect and sync software inventory once
    pub async fn sync_software(&self) -> Result<()> {
        let auth_token = SecureStorage::get_token()
            .context("Failed to get auth token")?
            .context("Auth token not found")?;

        // Collect software in a blocking task (spawns OS processes)
        let items = tokio::task::spawn_blocking(software::collect_software)
            .await
            .context("Software collection task panicked")?
            .context("Failed to collect software inventory")?;

        log::info!("Collected {} software items, syncing to backend", items.len());

        let request = SoftwareInventoryRequest {
            auth_token,
            software: items,
        };

        let result = self.api_client.sync_software(request)
            .await
            .context("Failed to sync software inventory")?;

        log::info!("Software inventory synced: {} items stored", result.count);
        Ok(())
    }
}
