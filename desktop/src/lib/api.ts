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

// ---- Full API client ----

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  async getStatus() {
    return fetchJSON<{
      memory: { total: number; withEmbeddings: number; byCategory: Record<string, number>; byNamespace: Record<string, number> };
      model: { name: string; available: boolean; cached: boolean; loading: boolean; size: number };
      config?: { dataDir?: string; defaultNamespace?: string; recallLimit?: number; secretDetection?: boolean };
    }>(`${getApiBase()}/status`);
  },

  async getHealth() {
    return fetchJSON<{ status: string }>(`http://localhost:${port}/health`);
  },

  async getMemories(params: Record<string, string | number> = {}) {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    return fetchJSON<{
      memories: Memory[];
      pagination?: { total: number; limit: number; offset: number };
    }>(`${getApiBase()}/memories${query ? `?${query}` : ""}`);
  },

  async createMemory(data: {
    content: string;
    category?: string;
    entity?: string;
    confidence?: number;
    namespace?: string;
    tags?: string[];
  }) {
    return fetchJSON<{ memory: Memory }>(`${getApiBase()}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async searchMemories(query: string, options: { limit?: number; threshold?: number } = {}) {
    return fetchJSON<{ memories: Memory[] }>(`${getApiBase()}/memories/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, ...options }),
    });
  },

  async deleteMemory(id: string) {
    return fetchJSON<{ success: boolean }>(`${getApiBase()}/memories/${id}`, {
      method: "DELETE",
    });
  },

  async consolidate(options: {
    detectDuplicates?: boolean;
    detectContradictions?: boolean;
    applyDecay?: boolean;
    cleanupStale?: boolean;
  } = {}) {
    return fetchJSON<{
      results: {
        duplicatesRemoved: number;
        contradictionsDetected: number;
        memoriesDecayed: number;
        duration: number;
      };
    }>(`${getApiBase()}/consolidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
  },

  async getConflicts() {
    return fetchJSON<{
      conflicts: Array<{
        conflictId: string;
        memories: Array<{ id: string; content: string; confidence: number }>;
      }>;
    }>(`${getApiBase()}/conflicts`);
  },

  async getInstallationInfo() {
    return fetchJSON<{
      installation: { binPath: string; platform: string };
    }>(`${getApiBase()}/installation-info`);
  },

  // Import wizard endpoints
  async getImportSources() {
    return fetchJSON<{
      sources: ImportSource[];
    }>(`${getApiBase()}/import/sources`);
  },

  async scanImportSources(sources: string[]) {
    return fetchJSON<{
      memories: ImportMemory[];
      skipped: Array<{ content: string; reason: string }>;
      warnings: string[];
      sources: string[];
      duration: number;
    }>(`${getApiBase()}/import/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources }),
    });
  },

  async commitImport(memories: ImportMemory[], namespace?: string) {
    return fetchJSON<{
      results: {
        created: number;
        duplicates: number;
        merged: number;
        rejected: number;
        errors: string[];
        duration: number;
      };
    }>(`${getApiBase()}/import/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memories, namespace }),
    });
  },
};

// ---- Shared types ----

export interface Memory {
  id: string;
  content: string;
  entity: string | null;
  category: string;
  confidence: number;
  namespace: string;
  tags: string[];
  source: string;
  createdAt: number;
  updatedAt: number;
  lastAccessed: number;
  accessCount: number;
  score?: number;
  scoreBreakdown?: {
    similarity: number;
    recency: number;
    confidence: number;
    access: number;
    ftsBoost: number;
  };
}

export interface ImportSource {
  id: string;
  name: string;
  label: string;
  description: string;
  category: string;
  detected: { found: boolean; path: string | null };
}

export interface ImportMemory {
  content: string;
  category: string;
  entity: string | null;
  confidence: number;
  tags: string[];
  source: string;
  selected?: boolean;
}
