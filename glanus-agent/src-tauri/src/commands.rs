// Command queue manager - processes and executes commands from backend
use anyhow::{Result, Context};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::client::{Command, ApiClient, CommandResultRequest};
use crate::executor::{ScriptExecutor, ExecutionResult};
use crate::storage::SecureStorage;

pub struct CommandQueue {
    pending: Arc<Mutex<Vec<Command>>>,
    api_client: ApiClient,
}

impl CommandQueue {
    pub fn new(api_url: String) -> Self {
        Self {
            pending: Arc::new(Mutex::new(Vec::new())),
            api_client: ApiClient::new(api_url),
        }
    }

    /// Add commands to the queue
    pub async fn enqueue(&self, commands: Vec<Command>) {
        let count = commands.len();
        let mut queue = self.pending.lock().await;
        queue.extend(commands);
        log::info!("Added {} commands to queue, total: {}", count, queue.len());
    }

    /// Process all pending commands
    pub async fn process_all(&self) -> Result<()> {
        let commands = {
            let mut queue = self.pending.lock().await;
            std::mem::take(&mut *queue) // Take all commands and clear queue
        };

        if commands.is_empty() {
            return Ok(());
        }

        log::info!("Processing {} commands", commands.len());

        use futures::StreamExt;

        // Process commands concurrently (up to 3 at a time)
        let stream = futures::stream::iter(commands.into_iter())
            .map(|cmd| self.execute_and_report(cmd))
            .buffer_unordered(3);

        // Execute all with strict concurrency limit
        let results: Vec<_> = stream.collect().await;

        let success_count = results.iter().filter(|r| r.is_ok()).count();
        let error_count = results.len() - success_count;

        log::info!("Command processing complete: {} succeeded, {} failed", success_count, error_count);

        Ok(())
    }

    /// Execute a single command and report result to backend
    async fn execute_and_report(&self, command: Command) -> Result<()> {
        log::info!("Executing command {}: {} script ({})", command.id, command.language, command.script_name);

        // Execute script using the language field as script type
        let result = ScriptExecutor::execute(
            &command.language,
            &command.script,
            None, // Platform does not send timeout; use default
        ).await
        .context("Failed to execute script")?;

        log::info!("Command {} finished with status: {}", command.id, result.status);

        // Report result to backend
        self.report_result(command.id, result).await?;

        Ok(())
    }

    /// Report execution result to backend
    async fn report_result(&self, execution_id: String, result: ExecutionResult) -> Result<()> {
        let auth_token = SecureStorage::get_token()
            .context("Failed to get auth token")?
            .context("Auth token not found")?;

        // Map agent status values to platform-expected lowercase values
        let platform_status = match result.status.as_str() {
            "SUCCESS" => "completed",
            "ERROR" => "failed",
            "TIMEOUT" => "timeout",
            other => other,
        };

        let request = CommandResultRequest {
            auth_token,
            execution_id,
            status: platform_status.to_string(),
            output: result.output,
            error: result.error,
            exit_code: result.exit_code,
            duration: Some(result.duration_ms),
        };

        self.api_client.report_command_result(request)
            .await
            .context("Failed to report command result")?;

        Ok(())
    }

    /// Get current queue size
    pub async fn size(&self) -> usize {
        self.pending.lock().await.len()
    }
}
