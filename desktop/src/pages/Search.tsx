import { useState } from "react";
import { motion } from "framer-motion";
import { api, Memory } from "../lib/api";

const CATEGORIES_COLORS: Record<string, string> = {
  preference: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  fact: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  pattern: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  decision: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  outcome: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState({ limit: 5, threshold: 0.3 });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.searchMemories(query, options);
      setResults(data.memories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="text-xl font-semibold">Search Memories</h2>
        <p className="mt-1 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          Hybrid search using semantic similarity, recency, and confidence scoring.
        </p>
      </div>

      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <form onSubmit={handleSearch} className="space-y-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to remember?"
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-transparent p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ color: "rgba(var(--text-primary), 1)" }}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                Max Results
              </label>
              <select
                value={options.limit}
                onChange={(e) => setOptions({ ...options, limit: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ color: "rgba(var(--text-primary), 1)" }}
              >
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                Threshold
              </label>
              <select
                value={options.threshold}
                onChange={(e) => setOptions({ ...options, threshold: parseFloat(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ color: "rgba(var(--text-primary), 1)" }}
              >
                <option value="0.1">0.1 (Low)</option>
                <option value="0.3">0.3 (Medium)</option>
                <option value="0.5">0.5 (High)</option>
                <option value="0.7">0.7 (Very High)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full py-2.5 text-sm font-medium text-white rounded-[10px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-[10px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            {results.length} result{results.length !== 1 ? "s" : ""}
          </h3>
          {results.map((memory, index) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="glass rounded-[10px] p-4 border border-gray-200/50 dark:border-gray-700/50"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-bold">
                  #{index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{memory.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORIES_COLORS[memory.category] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}`}>
                      {memory.category}
                    </span>
                    {memory.entity && (
                      <span className="text-xs font-mono" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                        {memory.entity}
                      </span>
                    )}
                    {memory.score !== undefined && (
                      <span className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                        Score: {memory.score.toFixed(3)}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                      {(memory.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>

                  {memory.scoreBreakdown && (
                    <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <p className="text-xs font-medium mb-2" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                        Score Breakdown
                      </p>
                      <div className="grid grid-cols-5 gap-2 text-xs">
                        {(["similarity", "recency", "confidence", "access", "ftsBoost"] as const).map((key) => (
                          <div key={key}>
                            <span style={{ color: "rgba(var(--text-secondary), 1)" }}>{key}:</span>
                            <span className="ml-1 font-medium">{memory.scoreBreakdown?.[key]?.toFixed(3) ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-2 text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                    {memory.namespace} &middot; {memory.accessCount}x accessed &middot; {memory.id.substring(0, 8)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && query && (
        <div className="text-center py-12 glass rounded-[10px] border border-gray-200/50 dark:border-gray-700/50">
          <p className="text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            No results found. Try adjusting your query or threshold.
          </p>
        </div>
      )}
    </div>
  );
}
