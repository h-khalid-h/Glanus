// Software inventory collector - gathers installed software per platform
use anyhow::Result;
use crate::client::SoftwareItem;

/// Collect installed software list from the OS
pub fn collect_software() -> Result<Vec<SoftwareItem>> {
    #[cfg(target_os = "windows")]
    return collect_windows();

    #[cfg(target_os = "macos")]
    return collect_macos();

    #[cfg(target_os = "linux")]
    return collect_linux();
}

#[cfg(target_os = "linux")]
fn collect_linux() -> Result<Vec<SoftwareItem>> {
    // Try dpkg first (Debian/Ubuntu), fall back to rpm (RHEL/Fedora)
    if let Ok(items) = collect_dpkg() {
        if !items.is_empty() {
            return Ok(items);
        }
    }
    collect_rpm()
}

#[cfg(target_os = "linux")]
fn collect_dpkg() -> Result<Vec<SoftwareItem>> {
    let output = std::process::Command::new("dpkg-query")
        .args(["--show", "--showformat=${Package}\t${Version}\t${Installed-Size}\n"])
        .output()?;

    if !output.status.success() {
        anyhow::bail!("dpkg-query failed");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let items: Vec<SoftwareItem> = stdout.lines().filter_map(|line| {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 2 {
            let size_mb = parts.get(2)
                .and_then(|s| s.parse::<f64>().ok())
                .map(|kb| kb / 1024.0); // dpkg reports in KB
            Some(SoftwareItem {
                name: parts[0].to_string(),
                version: Some(parts[1].to_string()),
                publisher: None,
                install_date: None,
                size_mb,
            })
        } else {
            None
        }
    }).collect();

    Ok(items)
}

#[cfg(target_os = "linux")]
fn collect_rpm() -> Result<Vec<SoftwareItem>> {
    let output = std::process::Command::new("rpm")
        .args(["-qa", "--queryformat", "%{NAME}\t%{VERSION}-%{RELEASE}\t%{VENDOR}\t%{SIZE}\n"])
        .output()?;

    if !output.status.success() {
        anyhow::bail!("rpm query failed");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let items: Vec<SoftwareItem> = stdout.lines().filter_map(|line| {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 2 {
            let publisher = parts.get(2).map(|s| s.to_string()).filter(|s| s != "(none)");
            let size_mb = parts.get(3)
                .and_then(|s| s.parse::<f64>().ok())
                .map(|bytes| bytes / (1024.0 * 1024.0));
            Some(SoftwareItem {
                name: parts[0].to_string(),
                version: Some(parts[1].to_string()),
                publisher,
                install_date: None,
                size_mb,
            })
        } else {
            None
        }
    }).collect();

    Ok(items)
}

#[cfg(target_os = "macos")]
fn collect_macos() -> Result<Vec<SoftwareItem>> {
    let output = std::process::Command::new("system_profiler")
        .args(["SPApplicationsDataType", "-json"])
        .output()?;

    if !output.status.success() {
        anyhow::bail!("system_profiler failed");
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)?;
    let mut items = Vec::new();

    if let Some(apps) = json.get("SPApplicationsDataType").and_then(|v| v.as_array()) {
        for app in apps {
            let name = app.get("_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if name.is_empty() { continue; }

            items.push(SoftwareItem {
                name,
                version: app.get("version").and_then(|v| v.as_str()).map(|s| s.to_string()),
                publisher: app.get("obtained_from").and_then(|v| v.as_str()).map(|s| s.to_string()),
                install_date: app.get("lastModified").and_then(|v| v.as_str()).map(|s| s.to_string()),
                size_mb: None,
            });
        }
    }

    Ok(items)
}

#[cfg(target_os = "windows")]
fn collect_windows() -> Result<Vec<SoftwareItem>> {
    // Use PowerShell to query installed programs from registry
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            r#"Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*,HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | Select-Object DisplayName,DisplayVersion,Publisher,InstallDate,EstimatedSize | ConvertTo-Json -Compress"#,
        ])
        .output()?;

    if !output.status.success() {
        anyhow::bail!("PowerShell query failed");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() {
        return Ok(Vec::new());
    }

    let json: serde_json::Value = serde_json::from_str(stdout.trim())?;

    let entries = match &json {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Ok(Vec::new()),
    };

    let items: Vec<SoftwareItem> = entries.iter().filter_map(|entry| {
        let name = entry.get("DisplayName")?.as_str()?.to_string();
        Some(SoftwareItem {
            name,
            version: entry.get("DisplayVersion").and_then(|v| v.as_str()).map(|s| s.to_string()),
            publisher: entry.get("Publisher").and_then(|v| v.as_str()).map(|s| s.to_string()),
            install_date: entry.get("InstallDate").and_then(|v| v.as_str()).map(|s| s.to_string()),
            size_mb: entry.get("EstimatedSize").and_then(|v| v.as_f64()).map(|kb| kb / 1024.0),
        })
    }).collect();

    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collect_software() {
        // Should not panic on any platform
        let result = collect_software();
        // It's ok if it fails in CI (no dpkg/rpm/etc), just shouldn't panic
        if let Ok(items) = result {
            // If it succeeds, should return non-empty list on a real system
            log::info!("Found {} installed software items", items.len());
        }
    }
}
