use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::sidecar::{health_check, SidecarState, SidecarStatus};

// --- Response types ---

#[derive(Debug, Serialize)]
pub struct AppStatus {
    pub running: bool,
    pub status: String,
    pub port: u16,
    pub memory_count: u64,
    pub uptime: Option<u64>,
    pub version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedAgent {
    pub id: String,
    pub name: String,
    pub config_path: String,
    pub connected: bool,
    pub available: bool,
}

#[derive(Debug, Deserialize)]
struct EngramStatusResponse {
    status: Option<String>,
    memories: Option<u64>,
    uptime: Option<u64>,
    version: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedOptions {
    pub claude_files: bool,
    pub git_config: bool,
    pub package_json: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPreferences {
    pub start_at_login: bool,
    pub sound_on_save: bool,
    pub rest_port: String,
    pub enable_rest_api: bool,
    pub log_level: String,
}

impl Default for DesktopPreferences {
    fn default() -> Self {
        Self {
            start_at_login: false,
            sound_on_save: true,
            rest_port: "3838".to_string(),
            enable_rest_api: true,
            log_level: "info".to_string(),
        }
    }
}

// --- Tauri commands ---

#[tauri::command]
pub async fn get_status(state: State<'_, SidecarState>) -> Result<AppStatus, String> {
    let sidecar_status = state.status.lock().await.clone();
    let port = *state.port.lock().await;
    let is_running = matches!(sidecar_status, SidecarStatus::Running);

    // Try to get live stats from the REST API
    if is_running {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(3))
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!("http://localhost:{}/api/status", port);
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(data) = resp.json::<EngramStatusResponse>().await {
                return Ok(AppStatus {
                    running: true,
                    status: data.status.unwrap_or_else(|| "running".to_string()),
                    port,
                    memory_count: data.memories.unwrap_or(0),
                    uptime: data.uptime,
                    version: data.version.unwrap_or_else(|| "unknown".to_string()),
                });
            }
        }
    }

    // Fallback when API is unreachable
    let status_str = match sidecar_status {
        SidecarStatus::Stopped => "stopped",
        SidecarStatus::Starting => "starting",
        SidecarStatus::Running => "running",
        SidecarStatus::Crashed => "crashed",
    };

    Ok(AppStatus {
        running: is_running,
        status: status_str.to_string(),
        port,
        memory_count: 0,
        uptime: None,
        version: "unknown".to_string(),
    })
}

#[tauri::command]
pub async fn check_first_run() -> Result<bool, String> {
    let engram_dir = get_engram_data_dir()?;
    let marker = engram_dir.join(".desktop-initialized");
    Ok(!marker.exists())
}

#[tauri::command]
pub async fn get_detected_agents() -> Result<Vec<DetectedAgent>, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let mut agents = Vec::new();

    // Claude Desktop
    let claude_desktop_path = if cfg!(target_os = "macos") {
        home.join("Library/Application Support/Claude/claude_desktop_config.json")
    } else {
        home.join(".config/Claude/claude_desktop_config.json")
    };
    agents.push(detect_agent(
        "claude-desktop",
        "Claude Desktop",
        &claude_desktop_path,
    ));

    // Claude Code
    let claude_code_path = home.join(".claude/mcp.json");
    agents.push(detect_agent("claude-code", "Claude Code", &claude_code_path));

    // Cursor
    let cursor_path = home.join(".cursor/mcp.json");
    agents.push(detect_agent("cursor", "Cursor", &cursor_path));

    // Windsurf
    let windsurf_path = home.join(".windsurf/mcp.json");
    agents.push(detect_agent("windsurf", "Windsurf", &windsurf_path));

    // ChatGPT — uses in-app settings, not a config file
    let chatgpt_installed = std::path::Path::new("/Applications/ChatGPT.app").exists();
    agents.push(DetectedAgent {
        id: "chatgpt".to_string(),
        name: "ChatGPT".to_string(),
        config_path: "Settings > MCP Servers (in-app)".to_string(),
        connected: false,
        available: chatgpt_installed,
    });

    Ok(agents)
}

#[tauri::command]
pub async fn configure_agent(agent_name: String) -> Result<String, String> {
    configure_agent_internal(&agent_name)
}

#[tauri::command]
pub async fn complete_onboarding(
    agents: Vec<String>,
    _seed_options: SeedOptions,
) -> Result<String, String> {
    let mut results = Vec::new();

    for agent_id in &agents {
        match configure_agent_internal(agent_id) {
            Ok(msg) => results.push(msg),
            Err(e) => results.push(format!("Failed to configure {}: {}", agent_id, e)),
        }
    }

    // Mark onboarding as complete
    let engram_dir = get_engram_data_dir()?;
    fs::create_dir_all(&engram_dir).map_err(|e| e.to_string())?;
    let marker = engram_dir.join(".desktop-initialized");
    fs::write(&marker, "").map_err(|e| e.to_string())?;

    Ok(results.join("\n"))
}

#[tauri::command]
pub async fn get_preferences() -> Result<DesktopPreferences, String> {
    let config_path = get_engram_data_dir()?.join("desktop-config.json");
    if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(DesktopPreferences::default())
    }
}

#[tauri::command]
pub async fn save_preferences(prefs: DesktopPreferences) -> Result<(), String> {
    let engram_dir = get_engram_data_dir()?;
    fs::create_dir_all(&engram_dir).map_err(|e| e.to_string())?;
    let config_path = engram_dir.join("desktop-config.json");
    let content = serde_json::to_string_pretty(&prefs).map_err(|e| e.to_string())?;
    fs::write(&config_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_start_at_login(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir().ok_or("Could not determine home directory")?;
        let plist_dir = home.join("Library/LaunchAgents");
        let plist_path = plist_dir.join("com.engram.app.plist");

        if enabled {
            fs::create_dir_all(&plist_dir).map_err(|e| e.to_string())?;

            let exe_path = std::env::current_exe()
                .map_err(|e| format!("Could not determine executable path: {}", e))?;

            let plist_content = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.engram.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>"#,
                exe_path.display()
            );

            fs::write(&plist_path, plist_content).map_err(|e| e.to_string())?;
        } else if plist_path.exists() {
            fs::remove_file(&plist_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn export_data() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let export_path = home
        .join("Desktop")
        .join(format!("engram-export-{}.json", timestamp));

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("http://localhost:3838/api/memories?limit=10000")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch memories: {}", e))?;

    let body = resp.text().await.map_err(|e| e.to_string())?;
    fs::write(&export_path, &body).map_err(|e| e.to_string())?;

    Ok(export_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn reset_database(app: tauri::AppHandle) -> Result<(), String> {
    crate::sidecar::stop_sidecar(&app).await?;

    let engram_dir = get_engram_data_dir()?;
    let db_path = engram_dir.join("memory.db");
    if db_path.exists() {
        fs::remove_file(&db_path)
            .map_err(|e| format!("Failed to delete database: {}", e))?;
    }
    // Also delete WAL and SHM files
    let _ = fs::remove_file(engram_dir.join("memory.db-wal"));
    let _ = fs::remove_file(engram_dir.join("memory.db-shm"));

    tokio::time::sleep(Duration::from_secs(1)).await;
    crate::sidecar::start_sidecar(&app)
}

#[tauri::command]
pub async fn restart_sidecar(app: tauri::AppHandle) -> Result<(), String> {
    crate::sidecar::stop_sidecar(&app).await?;
    tokio::time::sleep(Duration::from_secs(1)).await;
    crate::sidecar::start_sidecar(&app)
}

#[tauri::command]
pub async fn check_health() -> Result<bool, String> {
    Ok(health_check().await)
}

// --- Helper functions ---

fn get_engram_data_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home.join(".engram"))
}

fn detect_agent(id: &str, name: &str, config_path: &PathBuf) -> DetectedAgent {
    let available = config_path.parent().map_or(false, |p| p.exists());
    let connected = if config_path.exists() {
        fs::read_to_string(config_path)
            .ok()
            .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
            .map_or(false, |config| is_engram_configured(&config))
    } else {
        false
    };

    DetectedAgent {
        id: id.to_string(),
        name: name.to_string(),
        config_path: config_path.to_string_lossy().to_string(),
        connected,
        available,
    }
}

fn configure_agent_internal(agent_name: &str) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;

    // ChatGPT requires manual in-app configuration
    if agent_name == "chatgpt" {
        return Ok(
            "ChatGPT requires manual setup:\n\
             1. Open ChatGPT app\n\
             2. Go to Settings > Developer > MCP Servers\n\
             3. Add a new server with command: npx -y @hbarefoot/engram start --mcp-only"
                .to_string(),
        );
    }

    let config_path = match agent_name {
        "claude-desktop" => {
            if cfg!(target_os = "macos") {
                home.join("Library/Application Support/Claude/claude_desktop_config.json")
            } else {
                home.join(".config/Claude/claude_desktop_config.json")
            }
        }
        "claude-code" => home.join(".claude/mcp.json"),
        "cursor" => home.join(".cursor/mcp.json"),
        "windsurf" => home.join(".windsurf/mcp.json"),
        _ => return Err(format!("Unknown agent: {}", agent_name)),
    };

    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Read existing config or create empty
    let existing_content = if config_path.exists() {
        fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?
    } else {
        "{}".to_string()
    };

    let mut config: serde_json::Value = serde_json::from_str(&existing_content)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;

    // Check if engram is already configured
    if is_engram_configured(&config) {
        return Ok(format!("Engram is already configured for {}.", agent_name));
    }

    // Create backup before modifying
    if config_path.exists() {
        create_config_backup(&config_path)?;
    }

    // Build the engram MCP server entry
    let engram_entry = serde_json::json!({
        "command": "npx",
        "args": ["-y", "@hbarefoot/engram", "start", "--mcp-only"],
        "env": {}
    });

    // Merge into config
    let servers = config
        .as_object_mut()
        .ok_or("Config is not a JSON object")?
        .entry("mcpServers")
        .or_insert_with(|| serde_json::json!({}));

    servers
        .as_object_mut()
        .ok_or("mcpServers is not a JSON object")?
        .insert("engram".to_string(), engram_entry);

    // Write updated config
    let updated = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, &updated)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(format!(
        "Successfully configured engram for {}. Config written to: {}",
        agent_name,
        config_path.display()
    ))
}

fn is_engram_configured(config: &serde_json::Value) -> bool {
    config
        .get("mcpServers")
        .and_then(|s| s.as_object())
        .map_or(false, |servers| servers.contains_key("engram"))
}

fn create_config_backup(config_path: &PathBuf) -> Result<(), String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    let backup_name = format!(
        "{}.engram-backup-{}",
        config_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy(),
        timestamp
    );

    let backup_path = config_path
        .parent()
        .ok_or("No parent directory")?
        .join(backup_name);

    fs::copy(config_path, &backup_path)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    eprintln!(
        "[engram] Config backup created at: {}",
        backup_path.display()
    );

    Ok(())
}
