use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

use crate::sidecar::SidecarStatus;

const TRAY_ID: &str = "engram-tray";

/// Handles to the live tray menu items, stored in app state so the health-check
/// loop can refresh them with the current status + memory count.
pub struct TrayHandles {
    pub status: MenuItem<tauri::Wry>,
    pub memory_count: MenuItem<tauri::Wry>,
}

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Build the tray menu
    let status_item = MenuItemBuilder::with_id("status", "Status: Running")
        .enabled(false)
        .build(app)?;

    let memory_count_item = MenuItemBuilder::with_id("memory-count", "Memories: ...")
        .enabled(false)
        .build(app)?;

    let separator1 = PredefinedMenuItem::separator(app)?;

    let open_dashboard = MenuItemBuilder::with_id("open-dashboard", "Open Dashboard")
        .accelerator("CmdOrCtrl+D")
        .build(app)?;

    let quick_add = MenuItemBuilder::with_id("quick-add", "Quick Add Memory")
        .accelerator("CmdOrCtrl+Shift+M")
        .build(app)?;

    let separator2 = PredefinedMenuItem::separator(app)?;

    // Connected Agents submenu — detect status at build time
    let home = dirs::home_dir().unwrap_or_default();
    let agents_info: Vec<(&str, &str, std::path::PathBuf)> = vec![
        ("agent-claude-desktop", "Claude Desktop",
            if cfg!(target_os = "macos") {
                home.join("Library/Application Support/Claude/claude_desktop_config.json")
            } else {
                home.join(".config/Claude/claude_desktop_config.json")
            }),
        ("agent-claude-code", "Claude Code", home.join(".claude/mcp.json")),
        ("agent-cursor", "Cursor", home.join(".cursor/mcp.json")),
        ("agent-windsurf", "Windsurf", home.join(".windsurf/mcp.json")),
        ("agent-chatgpt", "ChatGPT", std::path::PathBuf::from("/Applications/ChatGPT.app")),
    ];

    let mut agents_submenu_builder = SubmenuBuilder::with_id(app, "agents", "Connected Agents");
    for (id, name, config_path) in &agents_info {
        let connected = if *id == "agent-chatgpt" {
            false // ChatGPT uses in-app config, can't detect
        } else {
            is_agent_connected(config_path)
        };
        let label = if connected {
            format!("{} \u{2713}", name) // ✓ checkmark
        } else {
            format!("{} — Click to connect", name)
        };
        agents_submenu_builder = agents_submenu_builder.item(
            &MenuItemBuilder::with_id(*id, label).build(app)?,
        );
    }
    let sep_agents = PredefinedMenuItem::separator(app)?;
    let manage_agents = MenuItemBuilder::with_id("manage-agents", "Manage Agents...")
        .build(app)?;
    let agents_submenu = agents_submenu_builder
        .item(&sep_agents)
        .item(&manage_agents)
        .build()?;

    let separator3 = PredefinedMenuItem::separator(app)?;

    let preferences = MenuItemBuilder::with_id("preferences", "Preferences")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let quit = MenuItemBuilder::with_id("quit", "Quit Engram")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .item(&memory_count_item)
        .item(&separator1)
        .item(&open_dashboard)
        .item(&quick_add)
        .item(&separator2)
        .item(&agents_submenu)
        .item(&separator3)
        .item(&preferences)
        .item(&quit)
        .build()?;

    // Load tray icon (embedded at compile time so it works in bundled apps)
    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png")).unwrap_or_else(|_| {
        // Fallback: create a minimal 1x1 RGBA pixel if icon not found
        Image::new_owned(vec![0, 0, 0, 255], 1, 1)
    });

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(false)
        .menu(&menu)
        .tooltip("Engram - AI Memory")
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event.id().as_ref());
        })
        .on_tray_icon_event(|tray_icon, event| {
            if let tauri::tray::TrayIconEvent::DoubleClick {
                button: tauri::tray::MouseButton::Left,
                ..
            } = event
            {
                // Double-click: toggle main window
                let app = tray_icon.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    // Keep handles to the live items so the health loop can refresh them.
    app.manage(TrayHandles {
        status: status_item,
        memory_count: memory_count_item,
    });

    Ok(())
}

/// Refresh the live tray menu items + tooltip with the current sidecar status
/// and memory count. Safe to call from any thread (marshals to the main thread,
/// which macOS requires for menu/tray mutations).
pub fn update_tray(app: &AppHandle, status: &SidecarStatus, memory_count: Option<u64>) {
    let status_text = match status {
        SidecarStatus::Running => "Status: Running",
        SidecarStatus::Starting => "Status: Starting",
        SidecarStatus::Stopped => "Status: Stopped",
        SidecarStatus::Crashed => "Status: Crashed",
    };
    let memory_text = match memory_count {
        Some(n) => format!("Memories: {}", n),
        None => "Memories: —".to_string(),
    };
    let tooltip = match memory_count {
        Some(n) => format!("Engram — {} memories", n),
        None => "Engram - AI Memory".to_string(),
    };

    let app = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        if let Some(handles) = app.try_state::<TrayHandles>() {
            let _ = handles.status.set_text(status_text);
            let _ = handles.memory_count.set_text(&memory_text);
        }
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some(&tooltip));
        }
    });
}

fn handle_menu_event(app: &AppHandle, event_id: &str) {
    match event_id {
        "open-dashboard" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.eval("window.location.hash = '#/'");
            }
        }
        "quick-add" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = app.emit("open-quick-add", ());
            }
        }
        "preferences" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.eval("window.location.hash = '#/preferences'");
            }
        }
        "manage-agents" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.eval("window.location.hash = '#/preferences?tab=agents'");
            }
        }
        id if id.starts_with("agent-") => {
            let agent_name = id.strip_prefix("agent-").unwrap_or(id);
            let _app_handle = app.clone();
            let name = agent_name.to_string();
            tauri::async_runtime::spawn(async move {
                match crate::commands::configure_agent(name).await {
                    Ok(msg) => eprintln!("[engram] {}", msg),
                    Err(e) => eprintln!("[engram] Failed to configure agent: {}", e),
                }
            });
        }
        "quit" => {
            // Stop sidecar before quitting
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = crate::sidecar::stop_sidecar(&app_handle).await;
                app_handle.exit(0);
            });
        }
        _ => {}
    }
}

fn is_agent_connected(config_path: &std::path::Path) -> bool {
    if !config_path.exists() {
        return false;
    }
    std::fs::read_to_string(config_path)
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
        .and_then(|config| config.get("mcpServers")?.as_object()?.get("engram").cloned())
        .is_some()
}
