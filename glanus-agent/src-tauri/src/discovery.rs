// Network discovery module - scans local network for devices
use anyhow::{Result, Context};
use crate::client::{ApiClient, DiscoveryRequest, DiscoveryDevice};
use crate::storage::SecureStorage;
use crate::config::DiscoverySettings;
use std::time::Duration;

pub struct DiscoveryManager {
    api_client: ApiClient,
    settings: DiscoverySettings,
}

impl DiscoveryManager {
    pub fn new(api_url: String, settings: DiscoverySettings) -> Self {
        Self {
            api_client: ApiClient::new(api_url),
            settings,
        }
    }

    /// Run discovery loop at configured interval
    pub async fn start_loop(&self) -> Result<()> {
        let interval = Duration::from_secs(self.settings.scan_interval);
        log::info!("Starting network discovery loop with {}s interval", self.settings.scan_interval);

        loop {
            tokio::time::sleep(interval).await;

            if let Err(e) = self.run_scan().await {
                log::error!("Network discovery scan failed: {}", e);
            }
        }
    }

    /// Run a single discovery scan and submit results
    pub async fn run_scan(&self) -> Result<()> {
        let subnet = self.settings.subnet.as_deref()
            .unwrap_or_else(|| {
                log::warn!("No subnet configured for discovery, using auto-detect");
                "auto"
            });

        let auth_token = SecureStorage::get_token()
            .context("Failed to get auth token")?
            .context("Auth token not found")?;

        // Collect devices from ARP table (blocking OS call)
        let subnet_str = subnet.to_string();
        let devices = tokio::task::spawn_blocking(move || collect_arp_devices(&subnet_str))
            .await
            .context("ARP collection task panicked")?
            .context("Failed to collect ARP table")?;

        if devices.is_empty() {
            log::info!("No devices found in ARP table");
            return Ok(());
        }

        log::info!("Discovered {} devices, submitting to backend", devices.len());

        let request = DiscoveryRequest {
            auth_token,
            subnet: subnet.to_string(),
            devices,
        };

        let result = self.api_client.submit_discovery(request)
            .await
            .context("Failed to submit discovery results")?;

        log::info!("Discovery submitted: scan_id={}, {} devices stored", result.scan_id, result.count);
        Ok(())
    }
}

/// Parse ARP table from OS to get discovered devices
fn collect_arp_devices(subnet: &str) -> Result<Vec<DiscoveryDevice>> {
    #[cfg(target_os = "windows")]
    return collect_arp_windows(subnet);

    #[cfg(target_os = "macos")]
    return collect_arp_unix(subnet, "arp", &["-a"]);

    #[cfg(target_os = "linux")]
    return collect_arp_unix(subnet, "arp", &["-n"]);
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn collect_arp_unix(subnet: &str, cmd: &str, args: &[&str]) -> Result<Vec<DiscoveryDevice>> {
    let output = std::process::Command::new(cmd)
        .args(args)
        .output()
        .context("Failed to run arp command")?;

    if !output.status.success() {
        anyhow::bail!("arp command failed");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in stdout.lines().skip(1) { // skip header
        if let Some(device) = parse_arp_line(line, subnet) {
            devices.push(device);
        }
    }

    // Also try reading /proc/net/arp on Linux for more complete results
    #[cfg(target_os = "linux")]
    {
        if let Ok(proc_arp) = std::fs::read_to_string("/proc/net/arp") {
            for line in proc_arp.lines().skip(1) {
                if let Some(device) = parse_proc_arp_line(line, subnet) {
                    // Avoid duplicates by IP
                    if !devices.iter().any(|d: &DiscoveryDevice| d.ip_address == device.ip_address) {
                        devices.push(device);
                    }
                }
            }
        }
    }

    Ok(devices)
}

/// Parse a line from `arp -n` (Linux) or `arp -a` (macOS) output
fn parse_arp_line(line: &str, _subnet: &str) -> Option<DiscoveryDevice> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 3 {
        return None;
    }

    // Linux `arp -n`: IP HW_TYPE MAC FLAGS MASK IFACE
    // macOS `arp -a`: hostname (IP) at MAC on IFACE ...
    let (ip, mac) = if line.contains('(') {
        // macOS format: hostname (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0
        let ip_start = line.find('(')? + 1;
        let ip_end = line.find(')')?;
        let ip = &line[ip_start..ip_end];
        let mac = parts.iter().position(|&p| p == "at").and_then(|i| parts.get(i + 1))?;
        (ip.to_string(), mac.to_string())
    } else {
        // Linux format
        (parts[0].to_string(), parts[2].to_string())
    };

    // Skip incomplete entries
    if mac == "(incomplete)" || mac == "<incomplete>" || mac == "ff:ff:ff:ff:ff:ff" {
        return None;
    }

    Some(DiscoveryDevice {
        ip_address: ip,
        mac_address: Some(mac),
        hostname: None,
        device_type: "UNKNOWN".to_string(),
    })
}

/// Parse a line from /proc/net/arp (Linux)
#[cfg(target_os = "linux")]
fn parse_proc_arp_line(line: &str, _subnet: &str) -> Option<DiscoveryDevice> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 6 {
        return None;
    }

    let ip = parts[0].to_string();
    let mac = parts[3].to_string();

    // Skip incomplete entries
    if mac == "00:00:00:00:00:00" {
        return None;
    }

    Some(DiscoveryDevice {
        ip_address: ip,
        mac_address: Some(mac),
        hostname: None,
        device_type: "UNKNOWN".to_string(),
    })
}

#[cfg(target_os = "windows")]
fn collect_arp_windows(_subnet: &str) -> Result<Vec<DiscoveryDevice>> {
    let output = std::process::Command::new("arp")
        .args(["-a"])
        .output()
        .context("Failed to run arp command")?;

    if !output.status.success() {
        anyhow::bail!("arp command failed");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        // Windows format: IP  MAC  TYPE
        if parts.len() >= 3 && parts[0].contains('.') {
            let mac = parts[1].to_string();
            if mac == "ff-ff-ff-ff-ff-ff" {
                continue;
            }
            devices.push(DiscoveryDevice {
                ip_address: parts[0].to_string(),
                mac_address: Some(mac.replace('-', ":")),
                hostname: None,
                device_type: "UNKNOWN".to_string(),
            });
        }
    }

    Ok(devices)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_arp_line_linux() {
        let line = "192.168.1.1      0x1         0x2         aa:bb:cc:dd:ee:ff     *        eth0";
        let device = parse_arp_line(line, "192.168.1.0/24");
        assert!(device.is_some());
        let d = device.unwrap();
        assert_eq!(d.ip_address, "192.168.1.1");
        assert_eq!(d.mac_address, Some("aa:bb:cc:dd:ee:ff".to_string()));
    }

    #[test]
    fn test_parse_arp_line_incomplete() {
        let line = "192.168.1.1      0x1         0x0         (incomplete)          *        eth0";
        let device = parse_arp_line(line, "192.168.1.0/24");
        assert!(device.is_none());
    }

    #[test]
    fn test_parse_arp_line_macos() {
        let line = "router (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]";
        let device = parse_arp_line(line, "192.168.1.0/24");
        assert!(device.is_some());
        let d = device.unwrap();
        assert_eq!(d.ip_address, "192.168.1.1");
        assert_eq!(d.mac_address, Some("aa:bb:cc:dd:ee:ff".to_string()));
    }
}
