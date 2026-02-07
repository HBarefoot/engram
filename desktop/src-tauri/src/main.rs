#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sidecar;
mod tray;

use sidecar::SidecarState;
use tauri::{Emitter, Manager};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(SidecarState::default())
        .setup(|app| {
            // Hide dock icon -- run as a menu bar (Accessory) app
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // Create the system tray
            if let Err(e) = tray::create_tray(app.handle()) {
                eprintln!("[engram] Failed to create tray: {}", e);
            }

            // Start the sidecar Node.js process (synchronous spawn)
            if let Err(e) = sidecar::start_sidecar(app.handle()) {
                eprintln!("[engram] Failed to start sidecar: {}", e);
            }

            // Set up crash recovery and health check loop
            sidecar::setup_sidecar_lifecycle(app.handle());

            // Register global shortcuts
            register_global_shortcuts(app.handle());

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide window on close instead of quitting the app
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::check_first_run,
            commands::get_detected_agents,
            commands::configure_agent,
            commands::complete_onboarding,
            commands::get_preferences,
            commands::save_preferences,
            commands::set_start_at_login,
            commands::export_data,
            commands::reset_database,
            commands::restart_sidecar,
            commands::check_health,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn register_global_shortcuts(app: &tauri::AppHandle) {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;

    let app_handle = app.clone();

    // Register Cmd+Shift+M for Quick Add Memory
    let result = app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+M", move |_app, _shortcut, event| {
        if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            let _ = app_handle.emit("open-quick-add", ());
        }
    });

    if let Err(e) = result {
        eprintln!("[engram] Failed to register Cmd+Shift+M shortcut: {}", e);
    }
}
