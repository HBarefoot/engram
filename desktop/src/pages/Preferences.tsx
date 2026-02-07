import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

type Tab = "general" | "agents" | "shortcuts" | "storage" | "advanced";

interface DetectedAgent {
  id: string;
  name: string;
  configPath: string;
  connected: boolean;
  available: boolean;
}

interface Prefs {
  startAtLogin: boolean;
  soundOnSave: boolean;
  restPort: string;
  enableRestApi: boolean;
  logLevel: string;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "agents", label: "Agents" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "storage", label: "Storage" },
  { id: "advanced", label: "Advanced" },
];

const SHORTCUTS = [
  { keys: ["Cmd", "Shift", "M"], action: "Quick Add Memory" },
  { keys: ["Cmd", ","], action: "Open Preferences" },
  { keys: ["Cmd", "Q"], action: "Quit Engram" },
];

const DEFAULT_PREFS: Prefs = {
  startAtLogin: false,
  soundOnSave: true,
  restPort: "3838",
  enableRestApi: true,
  logLevel: "info",
};

export default function Preferences() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [agents, setAgents] = useState<DetectedAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [connectingAgent, setConnectingAgent] = useState<string | null>(null);
  const navigate = useNavigate();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPreferences();
    // Check URL for tab param (e.g., #/preferences?tab=agents)
    const hash = window.location.hash;
    const tabMatch = hash.match(/[?&]tab=(\w+)/);
    if (tabMatch && TABS.some((t) => t.id === tabMatch[1])) {
      setActiveTab(tabMatch[1] as Tab);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "agents") {
      loadAgents();
    }
  }, [activeTab]);

  async function loadPreferences() {
    try {
      const loaded = await invoke<Prefs>("get_preferences");
      setPrefs(loaded);
    } catch {
      // Use defaults if Tauri not available
    }
  }

  function updatePref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      debounceSave(next);
      return next;
    });
  }

  function debounceSave(newPrefs: Prefs) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistPreferences(newPrefs);
    }, 500);
  }

  async function persistPreferences(prefsToSave: Prefs) {
    setSaving(true);
    try {
      await invoke("save_preferences", { prefs: prefsToSave });
    } catch {
      // Silently fail if Tauri not available
    } finally {
      setSaving(false);
    }
  }

  async function handleStartAtLogin(enabled: boolean) {
    updatePref("startAtLogin", enabled);
    try {
      await invoke("set_start_at_login", { enabled });
    } catch {
      // Revert on failure
      updatePref("startAtLogin", !enabled);
    }
  }

  async function loadAgents() {
    setAgentsLoading(true);
    try {
      const detected = await invoke<DetectedAgent[]>("get_detected_agents");
      setAgents(detected);
    } catch {
      setAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  }

  async function handleConnectAgent(agentId: string) {
    setConnectingAgent(agentId);
    try {
      const result = await invoke<string>("configure_agent", { agentName: agentId });
      if (agentId === "chatgpt") {
        setActionStatus(result);
      }
      await loadAgents(); // Refresh to show updated status
    } catch (err) {
      setActionStatus(`Failed to connect ${agentId}: ${err}`);
    } finally {
      setConnectingAgent(null);
    }
  }

  async function handleExport() {
    setActionStatus("Exporting...");
    try {
      const path = await invoke<string>("export_data");
      setExportPath(path);
      setActionStatus(`Exported to ${path}`);
    } catch (err) {
      setActionStatus(`Export failed: ${err}`);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionStatus("Importing...");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const memories: Array<{ content: string; category?: string; entity?: string; confidence?: number }> =
        data.memories || data;

      let imported = 0;
      for (const mem of memories) {
        try {
          await fetch("http://localhost:3838/api/memories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: mem.content,
              category: mem.category || "fact",
              entity: mem.entity || null,
              confidence: mem.confidence || 0.8,
            }),
          });
          imported++;
        } catch {
          // Skip individual failures
        }
      }
      setActionStatus(`Imported ${imported} memories`);
    } catch {
      setActionStatus("Import failed: invalid JSON file");
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleReset() {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }

    setActionStatus("Resetting database...");
    setResetConfirm(false);
    try {
      await invoke("reset_database");
      setActionStatus("Database reset successfully. Engram has been restarted.");
    } catch (err) {
      setActionStatus(`Reset failed: ${err}`);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-48 border-r border-gray-200 dark:border-gray-700 p-4 space-y-1">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 mb-4 transition-colors"
          style={{ color: "rgba(var(--text-secondary), 1)" }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <p
          className="text-xs font-medium uppercase tracking-wider px-3 mb-2"
          style={{ color: "rgba(var(--text-secondary), 1)" }}
        >
          Preferences
        </p>

        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
              activeTab === tab.id
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}

        {saving && (
          <p className="px-3 pt-4 text-xs text-indigo-500">Saving...</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-8 max-w-2xl">
        {activeTab === "general" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">General</h2>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">Start at login</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    Launch Engram automatically when you log in
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={prefs.startAtLogin}
                  onClick={() => handleStartAtLogin(!prefs.startAtLogin)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.startAtLogin ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.startAtLogin ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">Sound on save</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    Play a subtle sound when a memory is saved
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={prefs.soundOnSave}
                  onClick={() => updatePref("soundOnSave", !prefs.soundOnSave)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.soundOnSave ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.soundOnSave ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
        )}

        {activeTab === "agents" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Connected Agents</h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "rgba(var(--text-secondary), 1)" }}
              >
                Connect your AI agents to Engram so they can share persistent memory.
              </p>
            </div>

            {agentsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{agent.name}</span>
                        {agent.connected && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Connected
                          </span>
                        )}
                        {!agent.available && !agent.connected && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            Not installed
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs font-mono mt-0.5 truncate"
                        style={{ color: "rgba(var(--text-secondary), 1)" }}
                      >
                        {agent.configPath}
                      </p>
                    </div>
                    <button
                      onClick={() => handleConnectAgent(agent.id)}
                      disabled={agent.connected || connectingAgent === agent.id}
                      className={`ml-4 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        agent.connected
                          ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 cursor-default"
                          : connectingAgent === agent.id
                          ? "bg-gray-100 text-gray-400 dark:bg-gray-800 cursor-wait"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                    >
                      {agent.connected
                        ? "Connected"
                        : connectingAgent === agent.id
                        ? "Connecting..."
                        : agent.id === "chatgpt"
                        ? "Setup Guide"
                        : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {actionStatus && (
              <p
                className="text-xs p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                style={{ color: "rgba(var(--text-secondary), 1)" }}
              >
                {actionStatus}
              </p>
            )}
          </div>
        )}

        {activeTab === "shortcuts" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>

            <div className="space-y-2">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.action}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <span className="text-sm">{shortcut.action}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={i}>
                        {i > 0 && (
                          <span
                            className="mx-1 text-xs"
                            style={{ color: "rgba(var(--text-secondary), 1)" }}
                          >
                            +
                          </span>
                        )}
                        <kbd className="px-2 py-1 text-xs font-mono rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                          {key}
                        </kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "storage" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Storage</h2>

            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium">Database location</p>
                <p
                  className="text-xs font-mono mt-1"
                  style={{ color: "rgba(var(--text-secondary), 1)" }}
                >
                  ~/.engram/memory.db
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleExport}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Export Data
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Import Data
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
                <button
                  onClick={handleReset}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    resetConfirm
                      ? "text-white bg-red-600 border-red-600 hover:bg-red-700"
                      : "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                  }`}
                >
                  {resetConfirm ? "Confirm Reset" : "Reset Database"}
                </button>
              </div>

              {actionStatus && (
                <p
                  className="text-xs mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                  style={{ color: "rgba(var(--text-secondary), 1)" }}
                >
                  {actionStatus}
                </p>
              )}

              {exportPath && (
                <p
                  className="text-xs font-mono"
                  style={{ color: "rgba(var(--text-secondary), 1)" }}
                >
                  Last export: {exportPath}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "advanced" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Advanced</h2>

            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                <div>
                  <label className="text-sm font-medium">REST API Port</label>
                  <input
                    type="text"
                    value={prefs.restPort}
                    onChange={(e) => updatePref("restPort", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ color: "rgba(var(--text-primary), 1)" }}
                  />
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    Requires restart to take effect
                  </p>
                </div>
              </div>

              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">Enable REST API</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    Allow other applications to access Engram via HTTP
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={prefs.enableRestApi}
                  onClick={() => updatePref("enableRestApi", !prefs.enableRestApi)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.enableRestApi ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.enableRestApi ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="text-sm font-medium">Log level</label>
                <select
                  value={prefs.logLevel}
                  onChange={(e) => updatePref("logLevel", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ color: "rgba(var(--text-primary), 1)" }}
                >
                  <option value="error">Error</option>
                  <option value="warn">Warn</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
