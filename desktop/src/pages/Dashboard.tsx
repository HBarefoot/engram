import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:3838/api";

interface Memory {
  id: string;
  content: string;
  entity: string | null;
  category: string;
  confidence: number;
  namespace: string;
  tags: string[];
  createdAt: number;
  accessCount: number;
  score?: number;
}

interface StatusData {
  memory: {
    total: number;
    withEmbeddings: number;
    byCategory: Record<string, number>;
    byNamespace: Record<string, number>;
  };
  model: {
    name: string;
    available: boolean;
    cached: boolean;
    size: number;
  };
}

const CATEGORIES = ["all", "preference", "fact", "pattern", "decision", "outcome"];
const PAGE_SIZE = 20;

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    preference: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    fact: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    pattern: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    decision: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    outcome: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sidecarHealthy, setSidecarHealthy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalMemories, setTotalMemories] = useState(0);
  const navigate = useNavigate();

  const totalPages = Math.max(1, Math.ceil(totalMemories / PAGE_SIZE));

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3838/health");
      setSidecarHealthy(res.ok);
    } catch {
      setSidecarHealthy(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setStatus(data);
    } catch {
      // Status fetch failed -- non-critical
    }
  }, []);

  const loadMemories = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (activeCategory !== "all") {
        params.set("category", activeCategory);
      }
      const res = await fetch(`${API_BASE}/memories?${params}`);
      if (!res.ok) throw new Error("Failed to fetch memories");
      const data = await res.json();
      setMemories(data.memories || []);
      setTotalMemories(data.pagination?.total ?? data.memories?.length ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories");
    }
  }, [activeCategory, page]);

  const searchMemories = useCallback(async (query: string) => {
    if (!query.trim()) {
      loadMemories();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/memories/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 20 }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setMemories(data.memories || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }, [loadMemories]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${API_BASE}/memories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setTotalMemories((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await checkHealth();
      await loadStatus();
      await loadMemories();
      setLoading(false);
    }
    init();
  }, [checkHealth, loadStatus, loadMemories]);

  useEffect(() => {
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      loadMemories();
    }
  }, [activeCategory, loadMemories, searchQuery]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    searchMemories(searchQuery);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-5xl mx-auto">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/engram-logo.png" alt="Engram" className="h-8 w-8 rounded-lg" />
          <h1 className="text-2xl font-bold">Engram</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                sidecarHealthy ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {sidecarHealthy ? "Connected" : "Disconnected"}
          </div>
          {status && (
            <span
              className="text-sm"
              style={{ color: "rgba(var(--text-secondary), 1)" }}
            >
              {status.memory.total} memories
            </span>
          )}
          <button
            onClick={() => navigate("/preferences")}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Preferences"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "rgba(var(--text-secondary), 1)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit}>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            style={{ color: "rgba(var(--text-primary), 1)" }}
          />
        </div>
      </form>

      {/* Category filter tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setSearchQuery("");
              setPage(0);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Memory cards */}
      {memories.length === 0 ? (
        <div className="text-center py-16">
          <p
            className="text-sm"
            style={{ color: "rgba(var(--text-secondary), 1)" }}
          >
            {searchQuery
              ? "No memories match your search."
              : "No memories yet. Use the Quick Add shortcut or connect an AI agent to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                        memory.category
                      )}`}
                    >
                      {memory.category}
                    </span>
                    {memory.entity && (
                      <span
                        className="text-xs font-mono"
                        style={{ color: "rgba(var(--text-secondary), 1)" }}
                      >
                        {memory.entity}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{memory.content}</p>
                  <div
                    className="mt-2 flex items-center gap-4 text-xs"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    {/* Confidence bar */}
                    <div className="flex items-center gap-1.5">
                      <span>Confidence</span>
                      <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${memory.confidence * 100}%` }}
                        />
                      </div>
                      <span>{(memory.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <span>{formatDate(memory.createdAt)}</span>
                    <span>{memory.accessCount}x accessed</span>
                    {memory.score !== undefined && (
                      <span>Score: {memory.score.toFixed(3)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(memory.id)}
                  className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                  title="Delete memory"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {memories.length > 0 && !searchQuery && (
        <div className="flex items-center justify-between pt-2">
          <p
            className="text-xs"
            style={{ color: "rgba(var(--text-secondary), 1)" }}
          >
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalMemories)} of{" "}
            {totalMemories}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                    page === i
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {i + 1}
                </button>
              )).slice(
                Math.max(0, page - 2),
                Math.min(totalPages, page + 3)
              )}
              {page + 3 < totalPages && (
                <span className="px-1 text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>...</span>
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Agent status */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h2
          className="text-xs font-medium uppercase tracking-wider mb-3"
          style={{ color: "rgba(var(--text-secondary), 1)" }}
        >
          Sidecar Status
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                sidecarHealthy ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm">
              REST API (port 3838):{" "}
              {sidecarHealthy ? "Running" : "Not running"}
            </span>
          </div>
          {status?.model && (
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  status.model.available ? "bg-green-500" : "bg-yellow-500"
                }`}
              />
              <span className="text-sm">
                Embedding model: {status.model.available ? "Ready" : "Not loaded"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
