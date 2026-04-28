// Script executor module - runs PowerShell, Bash, and Python scripts
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command as TokioCommand;
use tokio::time::timeout;

pub struct ScriptExecutor;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResult {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub started_at: u64,
    pub finished_at: u64,
}

impl ScriptExecutor {
    /// Execute a script based on its type
    pub async fn execute(
        script_type: &str,
        script: &str,
        timeout_secs: Option<u64>,
    ) -> Result<ExecutionResult> {
        let timeout_duration = Duration::from_secs(timeout_secs.unwrap_or(600)); // Default: 10 min
        let start_time = std::time::Instant::now();

        let result = match timeout(
            timeout_duration,
            Self::execute_script(script_type, script, start_time)
        ).await {
            Ok(Ok(result)) => result,
            Ok(Err(e)) => {
                // Execution error
                let finished_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
                let started_at = finished_at - start_time.elapsed().as_millis() as u64;
                ExecutionResult {
                    success: false,
                    exit_code: None,
                    stdout: "".to_string(),
                    stderr: format!("Execution failed: {}", e),
                    started_at,
                    finished_at,
                }
            }
            Err(_) => {
                // Timeout
                let finished_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
                let started_at = finished_at - start_time.elapsed().as_millis() as u64;
                ExecutionResult {
                    success: false,
                    exit_code: None,
                    stdout: "".to_string(),
                    stderr: format!("Script execution timed out after {}s", timeout_duration.as_secs()),
                    started_at,
                    finished_at,
                }
            }
        };

        Ok(result)
    }

    /// Execute script based on type
    async fn execute_script(script_type: &str, script: &str, _start_instant: std::time::Instant) -> Result<ExecutionResult> {
        let started_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;

        let (command, args) = match script_type.to_uppercase().as_str() {
            "POWERSHELL" => {
                if cfg!(target_os = "windows") {
                    ("powershell.exe", vec!["-ExecutionPolicy", "Bypass", "-NonInteractive", "-NoProfile", "-Command", script])
                } else {
                    // PowerShell Core on macOS/Linux
                    ("pwsh", vec!["-NonInteractive", "-NoProfile", "-Command", script])
                }
            }
            "BASH" => {
                ("bash", vec!["-c", script])
            }
            "PYTHON" => {
                ("python3", vec!["-c", script])
            }
            _ => {
                anyhow::bail!("Unsupported script type: {}", script_type);
            }
        };

        // Execute command
        let output = TokioCommand::new(command)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .context(format!("Failed to execute {} command", script_type))?;

        let finished_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
        let exit_code = output.status.code();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let success = output.status.success();

        Ok(ExecutionResult {
            success,
            exit_code,
            stdout,
            stderr,
            started_at,
            finished_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_bash_echo() {
        let result = ScriptExecutor::execute("BASH", "echo 'Hello, World!'", Some(5))
            .await
            .unwrap();
        
        assert_eq!(result.success, true);
        assert!(result.stdout.contains("Hello, World!"));
        assert_eq!(result.exit_code, Some(0));
    }

    #[tokio::test]
    async fn test_python_print() {
        let result = ScriptExecutor::execute("PYTHON", "print('Hello from Python')", Some(5))
            .await
            .unwrap();
        
        assert_eq!(result.success, true);
        assert!(result.stdout.contains("Hello from Python"));
        assert_eq!(result.exit_code, Some(0));
    }

    #[tokio::test]
    async fn test_timeout() {
        let result = ScriptExecutor::execute("BASH", "sleep 10", Some(1))
            .await
            .unwrap();
        
        assert_eq!(result.success, false);
        assert!(result.stderr.contains("timed out"));
    }

    #[tokio::test]
    async fn test_error() {
        let result = ScriptExecutor::execute("BASH", "exit 1", Some(5))
            .await
            .unwrap();
        
        assert_eq!(result.success, false);
        assert_eq!(result.exit_code, Some(1));
    }
}
