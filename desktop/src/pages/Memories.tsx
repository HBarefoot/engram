import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { api, Memory } from "../lib/api";
import CreateMemoryModal from "../components/CreateMemoryModal";

const CATEGORIES = ["all", "preference", "fact", "pattern", "decision", "outcome"];
const PAGE_SIZE = 20;

const CATEGORY_COLORS: Record<string, string> = {
  preference: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  fact: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  pattern: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  decision: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  outcome: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Memories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [namespace, setNamespace] = useState("");
  const [page, setPage] = useState(0);
  const [totalMemories, setTotalMemories] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalMemories / PAGE_SIZE));

  const loadMemories = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (activeCategory !== "all") params.category = activeCategory;
      if (namespace) params.namespace = namespace;

      const data = await api.getMemories(params);
      setMemories(data.memories || []);
      setTotalMemories(data.pagination?.total ?? data.memories?.length ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, namespace, page]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  async function handleDelete(id: string) {
    try {
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setTotalMemories((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Memories</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-[10px] bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Memory
        </button>
      </div>

      {/* Filters */}
      <div className="glass rounded-[10px] p-4 border border-gray-200/50 dark:border-gray-700/50 space-y-3">
        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setPage(0);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Namespace filter */}
        <input
          type="text"
          value={namespace}
          onChange={(e) => {
            setNamespace(e.target.value);
            setPage(0);
          }}
          placeholder="Filter by namespace..."
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          style={{ color: "rgba(var(--text-primary), 1)" }}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-[10px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Memory list */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center py-16 glass rounded-[10px] border border-gray-200/50 dark:border-gray-700/50">
          <p className="text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            No memories found. Create one to get started.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-[10px] bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Memory
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((memory, i) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="glass rounded-[10px] p-4 border border-gray-200/50 dark:border-gray-700/50 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        CATEGORY_COLORS[memory.category] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {memory.category}
                    </span>
                    {memory.entity && (
                      <span className="text-xs font-mono" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                        {memory.entity}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{memory.content}</p>

                  {/* Tags */}
                  {memory.tags && memory.tags.length > 0 && (
                    <div className="mt-2 flex items-center gap-1">
                      {memory.tags.map((tag, ti) => (
                        <span
                          key={ti}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                    <div className="flex items-center gap-1.5">
                      <span>Confidence</span>
                      <div className="w-14 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${memory.confidence * 100}%` }} />
                      </div>
                      <span>{(memory.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <span>{formatDate(memory.createdAt)}</span>
                    <span>{memory.accessCount}x</span>
                    <span>{memory.namespace}</span>
                    <span className="font-mono">{memory.id.substring(0, 8)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(memory.id)}
                  className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                  title="Delete"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {memories.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalMemories)} of {totalMemories}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Prev
            </button>
            {Array.from(
              { length: Math.min(totalPages, page + 3) - Math.max(0, page - 2) },
              (_, idx) => {
                const i = Math.max(0, page - 2) + idx;
                return (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${
                      page === i
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              }
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateMemoryModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadMemories();
          }}
        />
      )}
    </div>
  );
}
