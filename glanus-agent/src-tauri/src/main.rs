// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(e) = std::panic::catch_unwind(app_lib::run) {
        eprintln!("Glanus Agent crashed: {:?}", e);
        std::process::exit(1);
    }
}
