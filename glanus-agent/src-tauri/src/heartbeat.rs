// Heartbeat loop - sends metrics and polls for commands every 60 seconds
use anyhow::{Result, Context};
use rand::Rng;
use std::time::Duration;
use std::sync::Arc;
use tokio::time;
use crate::client::{ApiClient, HeartbeatRequest, HeartbeatMetrics, ProcessInfo, Command, AgentCapabilities};
use crate::monitor::SystemMonitor;
use crate::storage::SecureStorage;
use crate::config::AgentConfig;
use crate::commands::CommandQueue;

pub struct HeartbeatManager {
    api_client: ApiClient,
    monitor: SystemMonitor,
    command_queue: Arc<CommandQueue>,
}

impl HeartbeatManager {
    pub fn new(api_url: String) -> Self {
        let command_queue = Arc::new(CommandQueue::new(api_url.clone()));
        
        Self {
            api_client: ApiClient::new(api_url),
            monitor: SystemMonitor::new(),
            command_queue,
        }
    }

    /// Start heartbeat loop (runs indefinitely)
    pub async fn start_loop(&mut self, config: &AgentConfig) -> Result<()> {
        let base_interval = Duration::from_secs(config.server.heartbeat_interval.max(5));
        let mut consecutive_failures: u32 = 0;

        log::info!("Starting heartbeat loop with {}s base interval", config.server.heartbeat_interval);

        loop {
            // Jitter avoids synchronized spikes when large fleets reconnect together.
            let jitter_factor = rand::thread_rng().gen_range(0.8_f64..=1.2_f64);
            let jittered = Duration::from_secs_f64(base_interval.as_secs_f64() * jitter_factor);

            // Exponential backoff on failures, capped to 5 minutes.
            let backoff_seconds = if consecutive_failures == 0 {
                0
            } else {
                (2_u64.pow(consecutive_failures.min(8))).min(300)
            };
            let sleep_for = jittered + Duration::from_secs(backoff_seconds);
            time::sleep(sleep_for).await;

            match self.send_heartbeat().await {
                Ok(_) => {
                    consecutive_failures = 0;
                }
                Err(e) => {
                    consecutive_failures = consecutive_failures.saturating_add(1);
                    log::error!("Heartbeat failed (attempt {}): {}", consecutive_failures, e);
                }
            }

            // Process any pending commands/results even while heartbeat is failing.
            if let Err(e) = self.command_queue.process_all().await {
                log::error!("Command processing failed: {}", e);
            }
        }
    }

    /// Send single heartbeat
    async fn send_heartbeat(&mut self) -> Result<Vec<Command>> {
        // Get auth token
        let auth_token = SecureStorage::get_token()
            .context("Failed to get auth token")?
            .context("Auth token not found - agent not registered")?;

        // Collect metrics
        let metrics = self.monitor.collect_metrics()
            .context("Failed to collect system metrics")?;

        // Convert to heartbeat format
        let heartbeat_metrics = HeartbeatMetrics {
            cpu: metrics.cpu_usage,
            ram: metrics.ram_usage,
            disk: metrics.disk_usage,
            cpu_temp: metrics.cpu_temp,
            ram_used: metrics.ram_used_gb,
            ram_total: metrics.ram_total_gb,
            disk_used: metrics.disk_used_gb,
            disk_total: metrics.disk_total_gb,
            network_up: metrics.network_up_kbps,
            network_down: metrics.network_down_kbps,
            top_processes: metrics.top_processes.iter().map(|p| ProcessInfo {
                name: p.name.clone(),
                cpu: p.cpu,
                ram: p.ram_mb,
                pid: Some(p.pid),
            }).collect(),
        };

        // Send heartbeat
        let request = HeartbeatRequest {
            auth_token,
            metrics: heartbeat_metrics,
            capabilities: Some(AgentCapabilities {
                // Driven purely by the compile-time feature flag so the flag
                // is the single source of truth for "this binary can host RD".
                remote_desktop: cfg!(feature = "remote_desktop"),
            }),
        };

        let response = self.api_client.heartbeat(request)
            .await
            .context("Failed to send heartbeat to backend")?;

        log::debug!("Heartbeat sent successfully, received {} commands", response.commands.len());

        // Enqueue commands for processing
        if !response.commands.is_empty() {
            self.command_queue.enqueue(response.commands.clone()).await;
        }

        Ok(response.commands)
    }

    /// Send heartbeat once and return commands (for testing)
    #[allow(dead_code)]
    pub async fn send_once(&mut self) -> Result<Vec<Command>> {
        self.send_heartbeat().await
    }
}

