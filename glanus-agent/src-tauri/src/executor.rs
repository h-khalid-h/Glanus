// Script executor module - runs PowerShell, Bash, and Python scripts
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command as TokioCommand;
use tokio::time::timeout;

pub struct ScriptExecutor;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub status: String, // "SUCCESS", "ERROR", "TIMEOUT"
    pub output: Option<String>,
    pub error: Option<String>,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
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
            Self::execute_script(script_type, script)
        ).await {
            Ok(Ok(result)) => result,
            Ok(Err(e)) => {
                // Execution error
                ExecutionResult {
                    status: "ERROR".to_string(),
                    output: None,
                    error: Some(format!("Execution failed: {}", e)),
                    exit_code: None,
                    duration_ms: start_time.elapsed().as_millis() as u64,
                }
            }
            Err(_) => {
                // Timeout
                ExecutionResult {
                    status: "TIMEOUT".to_string(),
                    output: None,
                    error: Some(format!("Script execution timed out after {}s", timeout_duration.as_secs())),
                    exit_code: None,
                    duration_ms: start_time.elapsed().as_millis() as u64,
                }
            }
        };

        Ok(result)
    }

    /// Execute script based on type
    async fn execute_script(script_type: &str, script: &str) -> Result<ExecutionResult> {
        let start_time = std::time::Instant::now();

        let (command, args) = match script_type.to_uppercase().as_str() {
            "POWERSHELL" => {
                if cfg!(target_os = "windows") {
                    ("powershell.exe", vec!["-Command", script])
                } else {
                    // PowerShell Core on macOS/Linux
                    ("pwsh", vec!["-Command", script])
                }
            }
            "BASH" => {
                if cfg!(target_os = "windows") {
                    // Git Bash or WSL
                    ("bash", vec!["-c", script])
                } else {
                    ("bash", vec!["-c", script])
                }
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

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let exit_code = output.status.code();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        let (status, output_text, error_text) = if output.status.success() {
            (
                "SUCCESS".to_string(),
                if stdout.is_empty() { None } else { Some(stdout) },
                if stderr.is_empty() { None } else { Some(stderr) },
            )
        } else {
            (
                "ERROR".to_string(),
                if stdout.is_empty() { None } else { Some(stdout) },
                Some(if stderr.is_empty() {
                    format!("Command failed with exit code: {}", exit_code.unwrap_or(-1))
                } else {
                    stderr
                }),
            )
        };

        Ok(ExecutionResult {
            status,
            output: output_text,
            error: error_text,
            exit_code,
            duration_ms,
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
        
        assert_eq!(result.status, "SUCCESS");
        assert!(result.output.unwrap().contains("Hello, World!"));
        assert_eq!(result.exit_code, Some(0));
    }

    #[tokio::test]
    async fn test_python_print() {
        let result = ScriptExecutor::execute("PYTHON", "print('Hello from Python')", Some(5))
            .await
            .unwrap();
        
        assert_eq!(result.status, "SUCCESS");
        assert!(result.output.unwrap().contains("Hello from Python"));
        assert_eq!(result.exit_code, Some(0));
    }

    #[tokio::test]
    async fn test_timeout() {
        let result = ScriptExecutor::execute("BASH", "sleep 10", Some(1))
            .await
            .unwrap();
        
        assert_eq!(result.status, "TIMEOUT");
    }

    #[tokio::test]
    async fn test_error() {
        let result = ScriptExecutor::execute("BASH", "exit 1", Some(5))
            .await
            .unwrap();
        
        assert_eq!(result.status, "ERROR");
        assert_eq!(result.exit_code, Some(1));
    }
}
