import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { getApiBase, getPort } from "../lib/api";

type Tab = "general" | "agents" | "ai" | "shortcuts" | "storage" | "advanced";

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

interface LlmForm {
  enabled: boolean;
  provider: "ollama" | "openai-compatible";
  endpoint: string;
  model: string;
}

const DEFAULT_LLM: LlmForm = {
  enabled: false,
  provider: "ollama",
  endpoint: "http://localhost:11434",
  model: "llama3.2:3b",
};

interface LlmLiveStatus {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  endpoint: string | null;
  reachable: boolean;
  latencyMs: number | null;
  checkedAt: string | null;
  isLocalEndpoint?: boolean;
  breakerOpen?: boolean;
  degraded?: boolean;
}

interface LlmEvent {
  ts: number;
  op: string;
  outcome: string;
  latencyMs: number | null;
  model: string | null;
}

interface LlmStats {
  enabled: boolean;
  calls: number;
  failures: number;
  timeouts: number;
  extractionsEnhanced: number;
  extractionsFallback: number;
  contradictionsConfirmed: number;
  contradictionsFiltered: number;
  avgLatencyMs: number;
  lastError: { message: string; at: number } | null;
  lastCallAt: number | null;
  recentEvents: LlmEvent[];
}

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "agents", label: "Agents" },
  { id: "ai", label: "AI Enhancement" },
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
  const [llm, setLlm] = useState<LlmForm>(DEFAULT_LLM);
  const [llmStatus, setLlmStatus] = useState<string | null>(null);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmSaving, setLlmSaving] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LlmLiveStatus | null>(null);
  const [stats, setStats] = useState<LlmStats | null>(null);
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
    if (activeTab === "ai") {
      loadLlmConfig();
    }
  }, [activeTab]);

  // Poll live LLM status + activity stats while the AI tab is open.
  useEffect(() => {
    if (activeTab !== "ai") return;
    let active = true;
    async function poll() {
      try {
        const [s, st] = await Promise.all([
          fetch(`${getApiBase()}/llm/status`).then((r) => (r.ok ? r.json() : null)),
          fetch(`${getApiBase()}/llm/stats`).then((r) => (r.ok ? r.json() : null)),
        ]);
        if (!active) return;
        if (s) setLiveStatus(s);
        if (st) setStats(st);
      } catch {
        // sidecar not reachable — leave previous values
      }
    }
    poll();
    const id = setInterval(poll, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [activeTab]);

  async function loadLlmConfig() {
    try {
      const res = await fetch(`${getApiBase()}/config/llm`);
      if (!res.ok) return;
      const data = await res.json();
      setLlm({
        enabled: !!data.provider,
        provider: data.provider === "openai-compatible" ? "openai-compatible" : "ollama",
        endpoint: data.endpoint || DEFAULT_LLM.endpoint,
        model: data.model || DEFAULT_LLM.model,
      });
    } catch {
      // Sidecar not reachable — keep defaults
    }
  }

  async function testLlmConnection() {
    setLlmTesting(true);
    setLlmStatus(null);
    try {
      const res = await fetch(`${getApiBase()}/llm/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: llm.provider, endpoint: llm.endpoint, model: llm.model }),
      });
      const data = await res.json();
      if (data.ok) {
        setLlmStatus(`✓ Connected to ${data.model || llm.model} (${data.latencyMs} ms)`);
      } else {
        setLlmStatus(`✗ ${data.error || "Connection failed"}`);
      }
    } catch (e) {
      setLlmStatus(`✗ ${e instanceof Error ? e.message : "Connection failed"}`);
    } finally {
      setLlmTesting(false);
    }
  }

  async function saveLlmConfig() {
    setLlmSaving(true);
    setLlmStatus(null);
    try {
      const body = llm.enabled
        ? { provider: llm.provider, endpoint: llm.endpoint, model: llm.model }
        : { provider: null };
      const res = await fetch(`${getApiBase()}/config/llm`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLlmStatus(`✗ ${err.error || "Failed to save"}`);
        return;
      }
      // Restart the sidecar so the layer takes effect.
      try {
        await invoke("restart_sidecar");
      } catch {
        // Tauri not available (e.g. dev browser) — config still saved
      }
      setLlmStatus(
        llm.enabled
          ? "✓ Saved. AI enhancement enabled — sidecar restarted."
          : "✓ Saved. AI enhancement disabled — using rule-based extraction."
      );
    } catch (e) {
      setLlmStatus(`✗ ${e instanceof Error ? e.message : "Failed to save"}`);
    } finally {
      setLlmSaving(false);
    }
  }

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
          await fetch(`${getApiBase()}/memories`, {
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
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    prefs.startAtLogin ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 shrink-0 transform rounded-full bg-white transition-transform ${
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
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    prefs.soundOnSave ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 shrink-0 transform rounded-full bg-white transition-transform ${
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
                  <div
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                    style={{ color: "rgba(var(--text-primary), 1)" }}
                  >
                    {getPort()}
                  </div>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    Auto-detected. Engram starts on 3838 and uses the next free port (up to 3842)
                    if it's busy — the app connects to it automatically.
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
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    prefs.enableRestApi ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 shrink-0 transform rounded-full bg-white transition-transform ${
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

        {activeTab === "ai" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">AI Enhancement (optional)</h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "rgba(var(--text-secondary), 1)" }}
              >
                Optional. Runs entirely on your machine via your own local model (Ollama).
                Free, off by default, and no memory data ever leaves your device. Disable to
                use Engram's built-in rule-based extraction.
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">Enable AI enhancement</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    Use a local model to sharpen categorization and cut false-positive
                    contradiction flags. Falls back to rules if the model is unreachable.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={llm.enabled}
                  onClick={() => setLlm((p) => ({ ...p, enabled: !p.enabled }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    llm.enabled ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 shrink-0 transform rounded-full bg-white transition-transform ${
                      llm.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              {/* Live status badge */}
              <div className="flex items-center gap-2 px-1 text-sm">
                {!liveStatus || !liveStatus.enabled ? (
                  <>
                    <span className="text-gray-400">○</span>
                    <span style={{ color: "rgba(var(--text-secondary), 1)" }}>
                      Disabled — using built-in rule-based extraction
                    </span>
                  </>
                ) : liveStatus.breakerOpen ? (
                  <>
                    <span className="text-amber-500">●</span>
                    <span>AI enhancement paused — model unreachable, using rules</span>
                  </>
                ) : liveStatus.reachable ? (
                  <>
                    <span className="text-green-500">●</span>
                    <span>
                      Connected · {liveStatus.model}
                      {liveStatus.latencyMs != null ? ` · ${liveStatus.latencyMs} ms` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-amber-500">●</span>
                    <span>Unreachable — falling back to rules</span>
                  </>
                )}
              </div>

              {/* Honesty warning: a non-local endpoint means content leaves the device */}
              {liveStatus?.enabled && liveStatus.isLocalEndpoint === false && (
                <p className="text-xs p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                  ⚠ This endpoint is not local — memory content will be sent to{" "}
                  <span className="font-mono">{(() => { try { return new URL(liveStatus.endpoint || "").host; } catch { return liveStatus.endpoint; } })()}</span>.
                  Use a local model (e.g. Ollama on localhost) to keep everything on your device.
                </p>
              )}

              {llm.enabled && (
                <>
                  <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <label className="text-sm font-medium">Provider</label>
                    <select
                      value={llm.provider}
                      onChange={(e) =>
                        setLlm((p) => ({ ...p, provider: e.target.value as LlmForm["provider"] }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      style={{ color: "rgba(var(--text-primary), 1)" }}
                    >
                      <option value="ollama">Ollama (local)</option>
                      <option value="openai-compatible">OpenAI-compatible (local)</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <label className="text-sm font-medium">Endpoint</label>
                    <input
                      type="text"
                      value={llm.endpoint}
                      onChange={(e) => setLlm((p) => ({ ...p, endpoint: e.target.value }))}
                      placeholder="http://localhost:11434"
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      style={{ color: "rgba(var(--text-primary), 1)" }}
                    />
                  </div>

                  <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <label className="text-sm font-medium">Model</label>
                    <input
                      type="text"
                      value={llm.model}
                      onChange={(e) => setLlm((p) => ({ ...p, model: e.target.value }))}
                      placeholder="llama3.2:3b"
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      style={{ color: "rgba(var(--text-primary), 1)" }}
                    />
                    <p
                      className="text-xs mt-1"
                      style={{ color: "rgba(var(--text-secondary), 1)" }}
                    >
                      For Ollama, pull the model first: <span className="font-mono">ollama pull llama3.2:3b</span>
                    </p>
                  </div>

                  <button
                    onClick={testLlmConnection}
                    disabled={llmTesting}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    {llmTesting ? "Testing…" : "Test connection"}
                  </button>
                </>
              )}

              <div>
                <button
                  onClick={saveLlmConfig}
                  disabled={llmSaving}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {llmSaving ? "Saving…" : "Save"}
                </button>
              </div>

              {/* Activity stats + recent events (preview of the upcoming Live Agent Activity feed) */}
              {liveStatus?.enabled && stats && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-semibold">Activity</h3>
                  {stats.calls === 0 ? (
                    <p
                      className="text-xs p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                      style={{ color: "rgba(var(--text-secondary), 1)" }}
                    >
                      No AI activity yet — store a memory and it'll show up here.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ["Enhanced extractions", stats.extractionsEnhanced],
                          ["Fell back to rules", stats.extractionsFallback],
                          ["Contradictions filtered", stats.contradictionsFiltered],
                          ["Total calls", stats.calls],
                          ["Avg latency", `${stats.avgLatencyMs} ms`],
                          ["Timeouts / failures", `${stats.timeouts} / ${stats.failures}`],
                        ] as [string, string | number][]).map(([label, value]) => (
                          <div
                            key={label}
                            className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                              {label}
                            </p>
                            <p className="text-lg font-semibold">{value}</p>
                          </div>
                        ))}
                      </div>

                      {stats.lastError && (
                        <p
                          className="text-xs p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                        >
                          Last error: {stats.lastError.message} ({new Date(stats.lastError.at).toLocaleTimeString()})
                        </p>
                      )}

                      <div>
                        <p className="text-xs font-medium mb-1">Recent activity</p>
                        <div className="space-y-1">
                          {stats.recentEvents.slice(0, 15).map((ev, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs font-mono px-2 py-1 rounded bg-gray-50 dark:bg-gray-800"
                            >
                              <span style={{ color: "rgba(var(--text-secondary), 1)" }}>
                                {new Date(ev.ts).toLocaleTimeString()} · {ev.op} · {ev.outcome}
                              </span>
                              <span style={{ color: "rgba(var(--text-secondary), 1)" }}>
                                {ev.latencyMs != null ? `${ev.latencyMs} ms` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {llmStatus && (
                <p
                  className="text-xs p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                  style={{ color: "rgba(var(--text-secondary), 1)" }}
                >
                  {llmStatus}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
