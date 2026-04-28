// Command queue manager - processes and executes commands from backend
use anyhow::{Result, Context};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::client::{Command, ApiClient, CommandResultRequest};
use crate::command_security::verify_signed_command;
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

    async fn flush_pending_results(&self) -> Result<()> {
        let pending = SecureStorage::list_pending_results()
            .context("Failed to load pending command results")?;

        if pending.is_empty() {
            return Ok(());
        }

        // Drop results that have been retrying for more than 24h. These are
        // almost always for executions whose DB row has been deleted on the
        // server (stale agent install, wiped env), and retrying forever
        // floods logs + eats rate-limit budget for no benefit.
        const MAX_AGE_SECS: i64 = 24 * 60 * 60;
        let now = chrono::Utc::now().timestamp();

        let mut retained = Vec::new();
        for item in pending {
            if now - item.created_at > MAX_AGE_SECS {
                log::warn!(
                    "Dropping pending result {} after >24h of retries",
                    item.execution_id
                );
                continue;
            }
            if let Err(e) = self.report_result(item.execution_id.clone(), item.result.clone()).await {
                log::warn!("Failed to flush pending result {}: {}", item.execution_id, e);
                retained.push(item);
            }
        }

        SecureStorage::replace_pending_results(retained)
            .context("Failed to persist remaining pending command results")?;
        Ok(())
    }

    /// Process all pending commands
    pub async fn process_all(&self) -> Result<()> {
        if let Err(e) = self.flush_pending_results().await {
            log::warn!("Pending result flush failed: {}", e);
        }

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

        let execution_id = command.id.clone();
        let start = std::time::Instant::now();

        let verification_result = verify_signed_command(&command);
        let result = if let Err(err) = verification_result {
            let finished_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
            let started_at = finished_at - start.elapsed().as_millis() as u64;
            ExecutionResult {
                success: false,
                stdout: "".to_string(),
                stderr: err.to_string(),
                exit_code: None,
                started_at,
                finished_at,
            }
        } else {
            match ScriptExecutor::execute(
                &command.language,
                &command.script,
                None, // Platform does not send timeout; use default
            ).await {
                Ok(executed) => executed,
                Err(e) => {
                    let finished_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
                    let started_at = finished_at - start.elapsed().as_millis() as u64;
                    ExecutionResult {
                        success: false,
                        stdout: "".to_string(),
                        stderr: format!("Execution failed: {}", e),
                        exit_code: None,
                        started_at,
                        finished_at,
                    }
                },
            }
        };

        log::info!("Command {} finished with success: {}", execution_id, result.success);

        // Report result to backend. If offline/unreachable, persist locally for replay.
        if let Err(e) = self.report_result(execution_id.clone(), result.clone()).await {
            SecureStorage::enqueue_pending_result(execution_id.clone(), result)
                .context("Failed to persist pending command result")?;
            return Err(e).context(format!("Failed to report command result for {}", execution_id));
        }

        Ok(())
    }

    /// Report execution result to backend
    async fn report_result(&self, execution_id: String, result: ExecutionResult) -> Result<()> {
        let auth_token = SecureStorage::get_token()
            .context("Failed to get auth token")?
            .context("Auth token not found")?;


        let request = CommandResultRequest {
            auth_token,
            execution_id,
            success: result.success,
            stdout: if result.stdout.is_empty() { None } else { Some(result.stdout) },
            stderr: if result.stderr.is_empty() { None } else { Some(result.stderr) },
            exit_code: result.exit_code,
            started_at: result.started_at,
            finished_at: result.finished_at,
        };

        self.api_client.report_command_result(request)
            .await
            .context("Failed to report command result")?;

        Ok(())
    }

    /// Get current queue size
    #[allow(dead_code)]
    pub async fn size(&self) -> usize {
        self.pending.lock().await.len()
    }
}
