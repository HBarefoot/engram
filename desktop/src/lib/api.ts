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
      version?: string;
      memory: { total: number; withEmbeddings: number; byCategory: Record<string, number>; byNamespace: Record<string, number> };
      model: { name: string; available: boolean; cached: boolean; loading: boolean; size: number };
      config?: { dataDir?: string; defaultNamespace?: string; recallLimit?: number; secretDetection?: boolean };
    }>(`${getApiBase()}/status`);
  },

  async getHealth() {
    return fetchJSON<{ status: string; version?: string }>(`http://localhost:${port}/health`);
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
  async getImportSources(paths?: string[]) {
    const params = new URLSearchParams();
    if (paths && paths.length > 0) params.set("paths", paths.join(","));
    const query = params.toString();
    return fetchJSON<{
      sources: ImportSource[];
    }>(`${getApiBase()}/import/sources${query ? `?${query}` : ""}`);
  },

  async scanImportSources(sources: string[], paths?: string[]) {
    const body: { sources: string[]; paths?: string[] } = { sources };
    if (paths && paths.length > 0) body.paths = paths;
    return fetchJSON<{
      memories: ImportMemory[];
      skipped: Array<{ content: string; reason: string }>;
      warnings: string[];
      sources: string[];
      duration: number;
    }>(`${getApiBase()}/import/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  async getAnalyticsOverview() {
    return fetchJSON<AnalyticsOverview>(`${getApiBase()}/analytics/overview`);
  },

  async getStaleMemories(days = 30, limit = 50) {
    return fetchJSON<StaleData>(`${getApiBase()}/analytics/stale?days=${days}&limit=${limit}`);
  },

  async getNeverRecalled(limit = 50) {
    return fetchJSON<NeverRecalledData>(`${getApiBase()}/analytics/never-recalled?limit=${limit}`);
  },

  async getDuplicates() {
    return fetchJSON<DuplicatesData>(`${getApiBase()}/analytics/duplicates`);
  },

  async getTrends(days = 30) {
    return fetchJSON<TrendsData>(`${getApiBase()}/analytics/trends?days=${days}`);
  },

  async bulkDeleteMemories(ids: string[]) {
    return fetchJSON<{ deleted: number }>(`${getApiBase()}/memories/bulk-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
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
  detected: { found: boolean; path: string | null; paths?: string[] };
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

export interface AnalyticsOverview {
  totalMemories: number;
  byCategory: Record<string, number>;
  byNamespace: Record<string, number>;
  createdLast7Days: number;
  createdLast30Days: number;
  avgConfidence: number;
  recallRate: number;
  healthScore: number;
}

export interface StaleItem {
  id: string;
  content: string;
  category: string;
  lastAccessed: number;
  daysSinceAccess: number;
}

export interface StaleData {
  items: StaleItem[];
  count: number;
}

export interface NeverRecalledItem {
  id: string;
  content: string;
  category: string;
  createdAt: number;
  daysSinceCreation: number;
}

export interface NeverRecalledData {
  items: NeverRecalledItem[];
  count: number;
}

export interface DuplicateCluster {
  memories: Array<{ id: string; content: string; category: string; confidence: number }>;
  similarity: number;
}

export interface DuplicatesData {
  clusters: DuplicateCluster[];
  totalDuplicates: number;
}

export interface TrendPoint {
  date: string;
  created: number;
  avgConfidence: number;
}

export interface TrendsData {
  daily: TrendPoint[];
}
