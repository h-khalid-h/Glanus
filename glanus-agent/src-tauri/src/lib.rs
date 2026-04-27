// Glanus Agent - Main Library with Backend Communication
mod monitor;
mod config;
mod client;
mod storage;
mod registration;
mod heartbeat;
mod executor;
mod commands;
mod command_security;
mod updater;
#[cfg(not(target_os = "linux"))]
mod input;
mod software;
mod inventory;
mod discovery;
#[cfg(feature = "remote_desktop")]
mod remote_desktop;

use config::AgentConfig;
use registration::RegistrationManager;

// Tauri GUI imports (used by GUI mode on all desktop platforms)
use std::sync::Mutex;
use monitor::{SystemMonitor, SystemMetrics};
use tauri::{
    AppHandle, Manager, State,
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    menu::{MenuBuilder, MenuItemBuilder},
};

// Global state — GUI mode only
struct AppState {
    monitor: Mutex<SystemMonitor>,
    config: Mutex<AgentConfig>,
}

/// ─── Tauri commands and GUI setup ─────────────────────────────────────────
#[tauri::command]
fn get_metrics(state: State<AppState>) -> Result<SystemMetrics, String> {
    let mut monitor = state.monitor.lock().map_err(|e| e.to_string())?;
    monitor.collect_metrics().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_config(state: State<AppState>) -> Result<AgentConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
fn update_config(new_config: AgentConfig, state: State<AppState>) -> Result<(), String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    *config = new_config.clone();
    new_config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn register_agent(asset_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let config = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        config_lock.clone()
    };

    // Check if already registered
    if RegistrationManager::is_registered(&config) {
        return Err("Agent is already registered".to_string());
    }

    // Register
    let registration_mgr = RegistrationManager::new(config.server.api_url.clone());
    registration_mgr.register(&config, Some(asset_id))
        .await
        .map_err(|e| format!("Registration failed: {}", e))?;

    // Update state
    let mut config_lock = state.config.lock().map_err(|e| e.to_string())?;
    *config_lock = AgentConfig::load().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn is_registered(state: State<AppState>) -> Result<bool, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(RegistrationManager::is_registered(&config))
}

#[tauri::command]
fn get_auth_token() -> Result<String, String> {
    storage::SecureStorage::get_token()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Agent not registered".to_string())
}

#[tauri::command]
fn show_metrics_window(app: AppHandle) -> Result<(), String> {
    // Create or show metrics window
    if let Some(window) = app.get_webview_window("metrics") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        tauri::WebviewWindowBuilder::new(
            &app,
            "metrics",
            tauri::WebviewUrl::App("index.html".into())
        )
        .title("Glanus Agent - System Metrics")
        .inner_size(800.0, 600.0)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        tauri::WebviewWindowBuilder::new(
            &app,
            "settings",
            tauri::WebviewUrl::App("index.html?view=settings".into())
        )
        .title("Glanus Agent - Settings")
        .inner_size(600.0, 500.0)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn setup_system_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Build menu
    let show_metrics = MenuItemBuilder::with_id("show_metrics", "View Metrics").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_metrics)
        .item(&settings)
        .item(&separator)
        .item(&quit)
        .build()?;

    // Build tray icon
    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Glanus Agent")
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "show_metrics" => {
                    if let Err(e) = show_metrics_window(app.clone()) {
                        eprintln!("Failed to show metrics window: {}", e);
                    }
                }
                "settings" => {
                    if let Err(e) = show_settings_window(app.clone()) {
                        eprintln!("Failed to show settings window: {}", e);
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event {
                // Left click - show/hide metrics window
                let app = tray.app_handle();
                if let Err(e) = show_metrics_window(app.clone()) {
                    eprintln!("Failed to show metrics window: {}", e);
                }
            }
        })
        .build(app)?;

    Ok(())
}

async fn wait_for_registration(config: &AgentConfig) -> AgentConfig {
    loop {
        let current_config = AgentConfig::load().unwrap_or_else(|_| config.clone());

        if RegistrationManager::is_registered(&current_config) {
            return current_config;
        }

        match RegistrationManager::auto_register_if_possible(&current_config).await {
            Ok(true) => {
                let reloaded = AgentConfig::load().unwrap_or(current_config);
                return reloaded;
            }
            Ok(false) => {
                log::info!("Waiting for agent registration...");
            }
            Err(e) => {
                log::warn!("Auto-registration attempt failed: {}", e);
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}

/// Start heartbeat loop in background
fn start_heartbeat_loop(config: AgentConfig) {
    use heartbeat::HeartbeatManager;
    tokio::spawn(async move {
        let runtime_config = wait_for_registration(&config).await;
        let mut heartbeat_mgr = HeartbeatManager::new(runtime_config.server.api_url.clone());

        log::info!("Agent registered, starting heartbeat loop");

        // Start loop
        if let Err(e) = heartbeat_mgr.start_loop(&runtime_config).await {
            log::error!("Heartbeat loop failed: {}", e);
        }
    });
}

/// Start software inventory sync loop in background
fn start_inventory_sync(config: AgentConfig) {
    use inventory::InventoryManager;

    if !config.inventory.enabled {
        log::info!("Software inventory sync disabled");
        return;
    }

    tokio::spawn(async move {
        let runtime_config = wait_for_registration(&config).await;

        // Initial delay: wait 2 minutes after startup before first sync
        tokio::time::sleep(tokio::time::Duration::from_secs(120)).await;

        let manager = InventoryManager::new(runtime_config.server.api_url.clone());

        // Sync once immediately, then loop at configured interval
        if let Err(e) = manager.sync_software().await {
            log::error!("Initial software inventory sync failed: {}", e);
        }

        if let Err(e) = manager.start_loop(runtime_config.inventory.sync_interval).await {
            log::error!("Inventory sync loop failed: {}", e);
        }
    });
}

/// Start network discovery loop in background
fn start_discovery_loop(config: AgentConfig) {
    use discovery::DiscoveryManager;

    if !config.discovery.enabled {
        log::info!("Network discovery disabled");
        return;
    }

    tokio::spawn(async move {
        let runtime_config = wait_for_registration(&config).await;

        // Initial delay: wait 3 minutes after startup before first scan
        tokio::time::sleep(tokio::time::Duration::from_secs(180)).await;

        let manager = DiscoveryManager::new(
            runtime_config.server.api_url.clone(),
            runtime_config.discovery.clone(),
        );

        // Run initial scan
        if let Err(e) = manager.run_scan().await {
            log::error!("Initial discovery scan failed: {}", e);
        }

        // Start loop
        if let Err(e) = manager.start_loop().await {
            log::error!("Discovery loop failed: {}", e);
        }
    });
}

/// Start update checker loop in background (check every 24 hours)
fn start_update_checker(config: AgentConfig) {
    use updater::AutoUpdater;
    
    tokio::spawn(async move {
        let updater = AutoUpdater::new(config.server.api_url.clone());
        let check_interval = std::time::Duration::from_secs(config.updates.check_interval);

        loop {
            // Wait for check interval
            tokio::time::sleep(check_interval).await;

            if !config.updates.enabled {
                log::debug!("Auto-updates disabled, skipping check");
                continue;
            }

            log::info!("Checking for updates...");

            match updater.check_and_install(&config.agent.version).await {
                Ok(true) => {
                    log::info!("Update installed successfully, restarting...");
                    // The installer should restart the agent
                    std::process::exit(0);
                }
                Ok(false) => {
                    log::info!("No update installed");
                }
                Err(e) => {
                    log::error!("Update check/install failed: {}", e);
                }
            }
        }
    });
}


/// Start the remote-desktop host loop. Compiled only when the
/// `remote_desktop` cargo feature is enabled; the no-op stub keeps the
/// non-RD build green while still letting `run_daemon`/`run_gui` call it
/// unconditionally.
#[cfg(feature = "remote_desktop")]
fn start_remote_desktop_loop(config: AgentConfig) {
    tokio::spawn(async move {
        let runtime_config = wait_for_registration(&config).await;
        log::info!("remote_desktop: starting host runtime");
        if let Err(e) = remote_desktop::run(runtime_config).await {
            log::error!("remote_desktop: runtime exited: {e:#}");
        }
    });
}

#[cfg(not(feature = "remote_desktop"))]
fn start_remote_desktop_loop(_config: AgentConfig) {
    log::info!("remote_desktop: feature disabled at build time, host runtime not started");
}

/// ─── Linux: headless daemon (no GUI / no display required) ─────────────────
#[cfg(target_os = "linux")]
pub fn run_daemon() {
    // Initialise logging to stderr so journald / systemd captures it
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let config = AgentConfig::load().unwrap_or_default();

    log::info!("Glanus Agent {} starting (daemon mode)", config.agent.version);

    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("Failed to create Tokio runtime");

    rt.block_on(async move {
        start_heartbeat_loop(config.clone());
        start_inventory_sync(config.clone());
        start_discovery_loop(config.clone());
        start_update_checker(config.clone());
        start_remote_desktop_loop(config.clone());

        // Block until SIGTERM or Ctrl-C
        #[cfg(unix)]
        {
            use tokio::signal::unix::{signal, SignalKind};
            let mut sigterm = signal(SignalKind::terminate())
                .expect("Failed to install SIGTERM handler");
            tokio::select! {
                _ = tokio::signal::ctrl_c() => log::info!("Received SIGINT, exiting"),
                _ = sigterm.recv() => log::info!("Received SIGTERM, exiting"),
            }
        }
        #[cfg(not(unix))]
        {
            tokio::signal::ctrl_c().await.ok();
            log::info!("Received shutdown signal, exiting");
        }
    });
}

/// ─── Full GUI via Tauri (Windows / macOS / Linux) ──────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run_gui() {
    let config = AgentConfig::load().unwrap_or_default();
    let monitor = SystemMonitor::new();

    // Start background tasks
    start_heartbeat_loop(config.clone());
    start_inventory_sync(config.clone());
    start_discovery_loop(config.clone());
    start_update_checker(config.clone());
    start_remote_desktop_loop(config.clone());

    let builder = tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Setup system tray
            setup_system_tray(app.handle())?;

            Ok(())
        })
        .manage(AppState {
            monitor: Mutex::new(monitor),
            config: Mutex::new(config),
        });

    // Input simulation (WebRTC remote control) is only available on
    // Windows/macOS — enigo does not currently support Linux reliably.
    #[cfg(not(target_os = "linux"))]
    let builder = builder
        .manage(input::InputState::new())
        .invoke_handler(tauri::generate_handler![
            get_metrics,
            get_config,
            update_config,
            register_agent,
            is_registered,
            get_auth_token,
            show_metrics_window,
            show_settings_window,
            input::simulate_input
        ]);

    #[cfg(target_os = "linux")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        get_metrics,
        get_config,
        update_config,
        register_agent,
        is_registered,
        get_auth_token,
        show_metrics_window,
        show_settings_window,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// ─── Entry point dispatcher ────────────────────────────────────────────────
///
/// On Windows/macOS always launches the GUI. On Linux, runs the headless
/// daemon when `--daemon` is present in argv or `GLANUS_DAEMON=1` is set,
/// otherwise launches the GUI.
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        let daemon_flag = std::env::args().any(|a| a == "--daemon" || a == "-d")
            || std::env::var("GLANUS_DAEMON").ok().as_deref() == Some("1");
        if daemon_flag {
            run_daemon();
            return;
        }
        run_gui();
    }
    #[cfg(not(target_os = "linux"))]
    {
        run_gui();
    }
}
