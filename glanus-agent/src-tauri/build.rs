fn main() {
    // tauri-build is only needed for the GUI (non-Linux) builds.
    // On Linux we run as a headless daemon with no Tauri runtime.
    #[cfg(not(target_os = "linux"))]
    tauri_build::build();
}
