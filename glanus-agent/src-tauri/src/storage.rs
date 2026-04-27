// Secure token storage using OS keychain + local durable queue artifacts
use anyhow::{Result, Context};
use chrono::Utc;
#[cfg(not(target_os = "linux"))]
use keyring::Entry;
use serde::{Deserialize, Serialize};

use crate::config::AgentConfig;
use crate::executor::ExecutionResult;

// Service / key names for the OS keychain. Only referenced under
// `#[cfg(not(target_os = "linux"))]`; the `allow(dead_code)` keeps
// Linux-only builds quiet without splitting the constants.
#[allow(dead_code)]
const SERVICE_NAME: &str = "com.glanus.agent";
#[allow(dead_code)]
const TOKEN_KEY: &str = "auth_token";
const PENDING_RESULTS_FILE: &str = "pending-command-results.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingCommandResult {
    pub execution_id: String,
    pub result: ExecutionResult,
    pub created_at: i64,
}

pub struct SecureStorage;

impl SecureStorage {
    fn pending_results_path() -> Result<std::path::PathBuf> {
        let config_path = AgentConfig::config_path()
            .context("Failed to resolve config path for queue persistence")?;
        let data_dir = config_path
            .parent()
            .context("Failed to resolve data directory for queue persistence")?;
        Ok(data_dir.join(PENDING_RESULTS_FILE))
    }

    fn load_pending_results() -> Result<Vec<PendingCommandResult>> {
        let path = Self::pending_results_path()?;
        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = std::fs::read_to_string(&path)
            .context("Failed to read pending command results")?;
        if content.trim().is_empty() {
            return Ok(Vec::new());
        }

        let parsed: Vec<PendingCommandResult> = serde_json::from_str(&content)
            .context("Failed to parse pending command results")?;
        Ok(parsed)
    }

    fn save_pending_results(results: &[PendingCommandResult]) -> Result<()> {
        let path = Self::pending_results_path()?;
        let content = serde_json::to_string_pretty(results)
            .context("Failed to serialize pending command results")?;
        std::fs::write(&path, content)
            .context("Failed to persist pending command results")?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
        }

        Ok(())
    }

    pub fn enqueue_pending_result(execution_id: String, result: ExecutionResult) -> Result<()> {
        let mut pending = Self::load_pending_results()?;
        pending.retain(|item| item.execution_id != execution_id);
        pending.push(PendingCommandResult {
            execution_id,
            result,
            created_at: Utc::now().timestamp(),
        });
        Self::save_pending_results(&pending)
    }

    pub fn list_pending_results() -> Result<Vec<PendingCommandResult>> {
        Self::load_pending_results()
    }

    pub fn replace_pending_results(results: Vec<PendingCommandResult>) -> Result<()> {
        Self::save_pending_results(&results)
    }
    fn token_file_path() -> Result<std::path::PathBuf> {
        let config_path = AgentConfig::config_path()
            .context("Failed to resolve config path for token storage")?;
        let data_dir = config_path
            .parent()
            .context("Failed to resolve data directory for token storage")?;
        Ok(data_dir.join("auth_token"))
    }

    fn store_token_file(token: &str) -> Result<()> {
        let path = Self::token_file_path()?;
        std::fs::write(&path, token).context("Failed to write token file")?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
        }
        Ok(())
    }

    fn read_token_file() -> Result<Option<String>> {
        let path = Self::token_file_path()?;
        if !path.exists() {
            return Ok(None);
        }
        let content = std::fs::read_to_string(&path)
            .context("Failed to read token file")?;
        let trimmed = content.trim().to_string();
        if trimmed.is_empty() {
            Ok(None)
        } else {
            Ok(Some(trimmed))
        }
    }

    /// Store auth token in OS keychain, falling back to a 0600 file.
    /// On Linux the daemon often runs without a D-Bus session (e.g. under
    /// systemd as root), so the file path is the reliable backend there.
    pub fn store_token(token: &str) -> Result<()> {
        #[cfg(not(target_os = "linux"))]
        {
            let entry = Entry::new(SERVICE_NAME, TOKEN_KEY)
                .context("Failed to create keychain entry")?;
            if entry.set_password(token).is_ok() {
                return Ok(());
            }
        }

        Self::store_token_file(token)
    }

    /// Retrieve auth token from OS keychain, falling back to the 0600 file.
    pub fn get_token() -> Result<Option<String>> {
        #[cfg(not(target_os = "linux"))]
        {
            if let Ok(entry) = Entry::new(SERVICE_NAME, TOKEN_KEY) {
                match entry.get_password() {
                    Ok(token) => return Ok(Some(token)),
                    Err(keyring::Error::NoEntry) => {}
                    Err(_) => {}
                }
            }
        }

        Self::read_token_file()
    }

    /// Delete auth token from both backends.
    #[allow(dead_code)]
    pub fn delete_token() -> Result<()> {
        #[cfg(not(target_os = "linux"))]
        {
            if let Ok(entry) = Entry::new(SERVICE_NAME, TOKEN_KEY) {
                let _ = entry.delete_credential();
            }
        }

        let path = Self::token_file_path()?;
        if path.exists() {
            std::fs::remove_file(&path).context("Failed to delete token file")?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Requires OS keychain (D-Bus secret service on Linux)
    fn test_token_storage() {
        let test_token = "test_token_123";
        
        // Store
        SecureStorage::store_token(test_token).unwrap();
        
        // Retrieve
        let retrieved = SecureStorage::get_token().unwrap();
        assert_eq!(retrieved, Some(test_token.to_string()));
        
        // Delete
        SecureStorage::delete_token().unwrap();
        
        // Verify deleted
        let after_delete = SecureStorage::get_token().unwrap();
        assert_eq!(after_delete, None);
    }
}
