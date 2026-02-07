use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Listener, Manager};
use tokio::sync::Mutex;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tokio::time::sleep;

const MAX_RESTART_ATTEMPTS: u32 = 3;
const HEALTH_CHECK_INTERVAL: Duration = Duration::from_secs(30);
const STARTUP_GRACE_PERIOD: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, serde::Serialize)]
pub enum SidecarStatus {
    Stopped,
    Starting,
    Running,
    Crashed,
}

pub struct SidecarState {
    pub child: Arc<Mutex<Option<CommandChild>>>,
    pub status: Arc<Mutex<SidecarStatus>>,
    pub restart_count: Arc<Mutex<u32>>,
    pub port: Arc<Mutex<u16>>,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            status: Arc::new(Mutex::new(SidecarStatus::Stopped)),
            restart_count: Arc::new(Mutex::new(0)),
            port: Arc::new(Mutex::new(3838)),
        }
    }
}

/// Try to find the packaged sidecar binary in the app's resource directory.
fn find_sidecar_binary(app: &AppHandle) -> Option<std::path::PathBuf> {
    let arch = match std::env::consts::ARCH {
        "aarch64" => "aarch64-apple-darwin",
        "x86_64" => "x86_64-apple-darwin",
        other => other,
    };
    let sidecar_name = format!("engram-sidecar-{}", arch);

    // Check the Tauri resource directory (production builds)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join(&sidecar_name);
        if candidate.exists() && candidate.is_file() {
            return Some(candidate);
        }
    }

    // Check relative to src-tauri/resources (development)
    let dev_path = std::path::PathBuf::from("resources").join(&sidecar_name);
    if dev_path.exists() && dev_path.is_file() {
        return Some(dev_path);
    }

    None
}

/// Find the engram project root by locating bin/engram.js relative to the executable.
fn find_engram_root(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let marker = std::path::Path::new("bin").join("engram.js");

    // First try: resolve from the app's resource directory (production builds)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join("engram");
        if candidate.join(&marker).exists() {
            return Ok(candidate);
        }
    }

    // Second try: walk up from the executable location (development)
    if let Ok(exe_path) = std::env::current_exe() {
        let mut dir = exe_path.parent().map(|p| p.to_path_buf());
        while let Some(d) = dir {
            if d.join(&marker).exists() {
                return Ok(d);
            }
            dir = d.parent().map(|p| p.to_path_buf());
        }
    }

    // Third try: check CARGO_MANIFEST_DIR (development with cargo)
    if let Some(manifest) = std::env::var("CARGO_MANIFEST_DIR").ok() {
        let repo_root = std::path::PathBuf::from(manifest)
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.to_path_buf());
        if let Some(root) = repo_root {
            if root.join(&marker).exists() {
                return Ok(root);
            }
        }
    }

    // Fourth try: use the current working directory
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join(&marker).exists() {
            return Ok(cwd);
        }
    }

    Err("Could not locate engram project root. Ensure bin/engram.js is accessible.".to_string())
}

pub fn start_sidecar(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<SidecarState>();

    // Check status synchronously via try_lock
    if let Ok(status) = state.status.try_lock() {
        if matches!(*status, SidecarStatus::Running | SidecarStatus::Starting) {
            return Ok(());
        }
    }

    if let Ok(mut status) = state.status.try_lock() {
        *status = SidecarStatus::Starting;
    }

    let port = state.port.try_lock().map(|p| *p).unwrap_or(3838);

    // Check if port is already in use by an existing Engram instance
    let addr: std::net::SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();
    if std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok() {
        eprintln!("[engram] Port {} already in use, attaching to existing instance", port);
        if let Ok(mut status) = state.status.try_lock() {
            *status = SidecarStatus::Running;
        }
        if let Ok(mut count) = state.restart_count.try_lock() {
            *count = 0;
        }
        return Ok(());
    }

    // Try packaged sidecar binary first (production), fall back to node (development)
    let shell = app.shell();
    let (mut rx, child) = if let Some(sidecar_path) = find_sidecar_binary(app) {
        eprintln!("[engram] Using packaged sidecar binary: {}", sidecar_path.display());
        shell
            .command(sidecar_path.to_string_lossy().as_ref())
            .args(["start", "--port", &port.to_string()])
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar binary: {}", e))?
    } else {
        let engram_root = find_engram_root(app)?;
        let script_path = engram_root.join("bin").join("engram.js");

        if !script_path.exists() {
            if let Ok(mut status) = state.status.try_lock() {
                *status = SidecarStatus::Crashed;
            }
            return Err(format!("Engram entry point not found at: {}", script_path.display()));
        }

        eprintln!("[engram] Using node to run: {}", script_path.display());
        shell
            .command("node")
            .args([
                script_path.to_string_lossy().as_ref(),
                "start",
                "--port",
                &port.to_string(),
            ])
            .spawn()
            .map_err(|e| format!("Failed to spawn engram process: {}", e))?
    };

    if let Ok(mut child_lock) = state.child.try_lock() {
        *child_lock = Some(child);
    }

    // Monitor stdout/stderr in background - use std::thread to avoid Send issues
    let status_arc = state.status.clone();
    let child_arc = state.child.clone();
    let restart_count_arc = state.restart_count.clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    eprintln!("[engram stdout] {}", text.trim());
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    eprintln!("[engram stderr] {}", text.trim());
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!(
                        "[engram] Process terminated with code: {:?}, signal: {:?}",
                        payload.code, payload.signal
                    );
                    *status_arc.lock().await = SidecarStatus::Crashed;
                    *child_arc.lock().await = None;
                    let _ = app_handle.emit("sidecar-status", "crashed");

                    // Signal restart needed
                    let mut count = restart_count_arc.lock().await;
                    if *count < MAX_RESTART_ATTEMPTS {
                        *count += 1;
                        let attempt = *count;
                        drop(count);
                        eprintln!(
                            "[engram] Sidecar crashed. Will restart (attempt {}/{})",
                            attempt, MAX_RESTART_ATTEMPTS
                        );
                        let delay = Duration::from_secs(2u64.pow(attempt));
                        sleep(delay).await;
                        let _ = app_handle.emit("sidecar-restart-needed", ());
                    } else {
                        eprintln!(
                            "[engram] Sidecar crashed {} times. Giving up auto-restart.",
                            MAX_RESTART_ATTEMPTS
                        );
                        let _ = app_handle.emit("sidecar-status", "failed");
                    }
                    break;
                }
                CommandEvent::Error(err) => {
                    eprintln!("[engram] Process error: {}", err);
                    *status_arc.lock().await = SidecarStatus::Crashed;
                    *child_arc.lock().await = None;
                    let _ = app_handle.emit("sidecar-restart-needed", ());
                    break;
                }
                _ => {}
            }
        }
    });

    // Mark as running after grace period
    let status_arc = state.status.clone();
    let restart_count_arc = state.restart_count.clone();
    let app_handle2 = app.clone();
    tauri::async_runtime::spawn(async move {
        sleep(STARTUP_GRACE_PERIOD).await;
        if health_check(port).await {
            *status_arc.lock().await = SidecarStatus::Running;
            *restart_count_arc.lock().await = 0;
            eprintln!("[engram] Sidecar started successfully on port {}", port);
            let _ = app_handle2.emit("sidecar-status", "running");
        } else {
            *status_arc.lock().await = SidecarStatus::Running;
            eprintln!("[engram] Sidecar started (health check pending)");
            let _ = app_handle2.emit("sidecar-status", "running");
        }
    });

    Ok(())
}

pub async fn stop_sidecar(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<SidecarState>();

    let mut child_lock = state.child.lock().await;
    if let Some(child) = child_lock.take() {
        child.kill().map_err(|e| format!("Failed to kill sidecar: {}", e))?;
        eprintln!("[engram] Sidecar stopped");
    }

    *state.status.lock().await = SidecarStatus::Stopped;
    *state.restart_count.lock().await = 0;

    let _ = app.emit("sidecar-status", "stopped");
    Ok(())
}

pub async fn health_check(port: u16) -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build();

    let client = match client {
        Ok(c) => c,
        Err(_) => return false,
    };

    let url = format!("http://localhost:{}/api/status", port);
    match client.get(&url).send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

/// Set up the restart listener and health check loop.
/// Call this once during app setup.
pub fn setup_sidecar_lifecycle(app: &AppHandle) {
    // Listen for restart requests (emitted when sidecar crashes)
    let app_handle = app.clone();
    app.listen("sidecar-restart-needed", move |_| {
        let handle = app_handle.clone();
        if let Err(e) = start_sidecar(&handle) {
            eprintln!("[engram] Failed to restart sidecar: {}", e);
        }
    });

    // Spawn periodic health check
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        sleep(Duration::from_secs(10)).await;

        loop {
            sleep(HEALTH_CHECK_INTERVAL).await;

            let state = app_handle.state::<SidecarState>();
            let status = state.status.lock().await.clone();

            let port = *state.port.lock().await;
            if matches!(status, SidecarStatus::Running) && !health_check(port).await {
                eprintln!("[engram] Health check failed, requesting restart");
                *state.status.lock().await = SidecarStatus::Crashed;
                *state.child.lock().await = None;
                let _ = app_handle.emit("sidecar-restart-needed", ());
            }
        }
    });
}
