// Secure token storage using OS keychain
use anyhow::{Result, Context};
use keyring::Entry;

const SERVICE_NAME: &str = "com.glanus.agent";
const TOKEN_KEY: &str = "auth_token";

pub struct SecureStorage;

impl SecureStorage {
    /// Store auth token in OS keychain
    pub fn store_token(token: &str) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, TOKEN_KEY)
            .context("Failed to create keychain entry")?;
        
        entry.set_password(token)
            .context("Failed to store token in keychain")?;
        
        Ok(())
    }

    /// Retrieve auth token from OS keychain
    pub fn get_token() -> Result<Option<String>> {
        let entry = Entry::new(SERVICE_NAME, TOKEN_KEY)
            .context("Failed to create keychain entry")?;
        
        match entry.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e).context("Failed to retrieve token from keychain"),
        }
    }

    /// Delete auth token from OS keychain
    pub fn delete_token() -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, TOKEN_KEY)
            .context("Failed to create keychain entry")?;
        
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(e).context("Failed to delete token from keychain"),
        }
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
