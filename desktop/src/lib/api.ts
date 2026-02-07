import { invoke } from "@tauri-apps/api/core";

const DEFAULT_PORT = 3838;

let port = DEFAULT_PORT;

/** Initialize the API port from saved preferences. Call once at app startup. */
export async function initApiPort(): Promise<void> {
  try {
    const prefs = await invoke<{ restPort: string }>("get_preferences");
    const parsed = parseInt(prefs.restPort, 10);
    if (parsed > 0) port = parsed;
  } catch {
    // Tauri not available (e.g. dev mode in browser) — use default
  }
}

export function getApiBase(): string {
  return `http://localhost:${port}/api`;
}

export function getHealthUrl(): string {
  return `http://localhost:${port}/health`;
}
