use anyhow::{Context, Result};
use base64::Engine;
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};

use crate::client::Command;

const DEFAULT_MAX_COMMAND_AGE_SECONDS: i64 = 300;
const MAX_SCRIPT_SIZE_BYTES: usize = 256 * 1024;

fn should_allow_unsigned_commands() -> bool {
    std::env::var("ALLOW_UNSIGNED_COMMANDS")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn command_payload(command: &Command, issued_at: &str) -> String {
    let script_hash = {
        let mut hasher = Sha256::new();
        hasher.update(command.script.as_bytes());
        hex::encode(hasher.finalize())
    };

    format!(
        "{}|{}|{}|{}",
        command.id,
        command.language.to_uppercase(),
        script_hash,
        issued_at
    )
}

pub fn verify_signed_command(command: &Command) -> Result<()> {
    if command.script.len() > MAX_SCRIPT_SIZE_BYTES {
        anyhow::bail!("Command rejected: script exceeds {} bytes", MAX_SCRIPT_SIZE_BYTES);
    }

    if should_allow_unsigned_commands() {
        return Ok(());
    }

    let signature = command
        .signature
        .as_ref()
        .context("Command rejected: signature is missing")?;
    let issued_at = command
        .issued_at
        .as_ref()
        .context("Command rejected: issuedAt is missing")?;

    let issued_at_dt = DateTime::parse_from_rfc3339(issued_at)
        .context("Command rejected: issuedAt is invalid")?
        .with_timezone(&Utc);

    let max_age_seconds = std::env::var("COMMAND_MAX_AGE_SECONDS")
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(DEFAULT_MAX_COMMAND_AGE_SECONDS)
        .max(30);

    let age = Utc::now().signed_duration_since(issued_at_dt).num_seconds().abs();
    if age > max_age_seconds {
        anyhow::bail!("Command rejected: signature is stale");
    }

    let public_key_b64 = std::env::var("COMMAND_SIGNING_PUBLIC_KEY_B64")
        .context("Command rejected: COMMAND_SIGNING_PUBLIC_KEY_B64 is not configured")?;

    let key_bytes = base64::engine::general_purpose::STANDARD
        .decode(public_key_b64.trim())
        .context("Command rejected: invalid command signing public key (base64)")?;
    if key_bytes.len() != 32 {
        anyhow::bail!("Command rejected: command signing public key must be 32 bytes");
    }
    let mut key_arr = [0u8; 32];
    key_arr.copy_from_slice(&key_bytes);
    let verifying_key = VerifyingKey::from_bytes(&key_arr)
        .context("Command rejected: invalid command signing public key")?;

    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(signature.trim())
        .context("Command rejected: invalid command signature (base64)")?;
    if sig_bytes.len() != 64 {
        anyhow::bail!("Command rejected: signature must be 64 bytes");
    }
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_arr);

    let payload = command_payload(command, issued_at);
    verifying_key
        .verify(payload.as_bytes(), &signature)
        .context("Command rejected: signature verification failed")?;

    Ok(())
}
