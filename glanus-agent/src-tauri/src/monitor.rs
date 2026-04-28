// System monitoring module for Glanus Agent
use serde::{Deserialize, Serialize};
use sysinfo::System;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub cpu_temp: Option<f32>,
    pub ram_usage: f32,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub disk_usage: f32,
    pub disk_used_gb: f32,
    pub disk_total_gb: f32,
    pub network_up_kbps: f32,
    pub network_down_kbps: f32,
    pub top_processes: Vec<ProcessInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub name: String,
    pub cpu: f32,
    pub ram_mb: f32,
    pub pid: u32,
}

pub struct SystemMonitor {
    sys: System,
    last_network_rx: u64,
    last_network_tx: u64,
}

impl SystemMonitor {
    pub fn new() -> Self {
        Self {
            sys: System::new_all(),
            last_network_rx: 0,
            last_network_tx: 0,
        }
    }

    /// Collect current system metrics
    pub fn collect_metrics(&mut self) -> Result<SystemMetrics> {
        // Refresh all system info
        self.sys.refresh_all();

        // CPU usage (global)
        let cpu_usage = self.sys.global_cpu_usage().min(100.0);

        // CPU temperature (if available)
        let cpu_temp = self.get_cpu_temperature();

        // RAM metrics
        let ram_total_gb = self.sys.total_memory() as f32 / 1_073_741_824.0; // bytes to GB
        let ram_used_gb = self.sys.used_memory() as f32 / 1_073_741_824.0;
        let ram_usage = if ram_total_gb > 0.0 {
            ((ram_used_gb / ram_total_gb) * 100.0).min(100.0)
        } else {
            0.0
        };

        // Disk metrics (aggregate all disks)
        let (disk_total_gb, disk_used_gb) = self.get_disk_metrics();
        let disk_usage = if disk_total_gb > 0.0 {
            ((disk_used_gb / disk_total_gb) * 100.0).min(100.0)
        } else {
            0.0
        };

        // Network metrics (calculate since last check)
        let (network_up_kbps, network_down_kbps) = self.get_network_metrics();

        // Top 5 processes by CPU usage
        let top_processes = self.get_top_processes(5);

        Ok(SystemMetrics {
            cpu_usage,
            cpu_temp,
            ram_usage,
            ram_used_gb,
            ram_total_gb,
            disk_usage,
            disk_used_gb,
            disk_total_gb,
            network_up_kbps,
            network_down_kbps,
            top_processes,
        })
    }

    /// Get CPU temperature (if supported by platform)
    fn get_cpu_temperature(&self) -> Option<f32> {
        // Note: sysinfo's temperature support is limited and platform-specific
        // For production, we might need platform-specific implementations
        #[cfg(target_os = "linux")]
        {
            let components = sysinfo::Components::new_with_refreshed_list();
            components
                .iter()
                .find(|c| c.label().to_lowercase().contains("cpu"))
                .map(|c| c.temperature())
        }
        
        #[cfg(not(target_os = "linux"))]
        {
            None
        }
    }

    /// Get aggregate disk metrics for all mounted drives
    fn get_disk_metrics(&self) -> (f32, f32) {
        use sysinfo::Disks;
        
        let disks = Disks::new_with_refreshed_list();
        let mut total_gb = 0.0;
        let mut used_gb = 0.0;

        for disk in disks.iter() {
            let disk_total = disk.total_space() as f32 / 1_073_741_824.0;
            let disk_avail = disk.available_space() as f32 / 1_073_741_824.0;
            let disk_used = disk_total - disk_avail;

            total_gb += disk_total;
            used_gb += disk_used;
        }

        (total_gb, used_gb)
    }

    /// Calculate network upload/download rates in KB/s
    fn get_network_metrics(&mut self) -> (f32, f32) {
        use sysinfo::Networks;
        
        let networks = Networks::new_with_refreshed_list();
        let mut total_rx = 0u64;
        let mut total_tx = 0u64;

        for (_interface_name, network) in networks.iter() {
            total_rx += network.received();
            total_tx += network.transmitted();
        }

        // Calculate delta since last check
        let rx_delta = if total_rx >= self.last_network_rx {
            total_rx - self.last_network_rx
        } else {
            0
        };

        let tx_delta = if total_tx >= self.last_network_tx {
            total_tx - self.last_network_tx
        } else {
            0
        };

        // Convert to KB/s (assuming 10-second collection interval)
        let interval_seconds = 10.0;
        let download_kbps = (rx_delta as f32 / 1024.0) / interval_seconds;
        let upload_kbps = (tx_delta as f32 / 1024.0) / interval_seconds;

        // Store for next delta calculation
        self.last_network_rx = total_rx;
        self.last_network_tx = total_tx;

        (upload_kbps, download_kbps)
    }

    /// Get top N processes by CPU usage
    fn get_top_processes(&self, count: usize) -> Vec<ProcessInfo> {
        let mut processes: Vec<ProcessInfo> = self
            .sys
            .processes()
            .values()
            .map(|process| ProcessInfo {
                name: process.name().to_string_lossy().to_string(),
                cpu: process.cpu_usage(),
                ram_mb: process.memory() as f32 / 1_048_576.0, // bytes to MB
                pid: process.pid().as_u32(),
            })
            .collect();

        // Sort by CPU usage descending
        processes.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap());

        // Take top N
        processes.into_iter().take(count).collect()
    }
}

impl Default for SystemMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_monitor_creation() {
        let monitor = SystemMonitor::new();
        assert!(monitor.sys.cpus().len() > 0);
    }

    #[test]
    fn test_metrics_collection() {
        let mut monitor = SystemMonitor::new();
        let metrics = monitor.collect_metrics();
        assert!(metrics.is_ok());
        
        let metrics = metrics.unwrap();
        assert!(metrics.cpu_usage >= 0.0 && metrics.cpu_usage <= 100.0);
        assert!(metrics.ram_usage >= 0.0 && metrics.ram_usage <= 100.0);
        assert!(metrics.disk_usage >= 0.0 && metrics.disk_usage <= 100.0);
    }
}
