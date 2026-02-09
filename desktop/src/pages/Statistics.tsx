import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";

interface StatusData {
  memory: {
    total: number;
    withEmbeddings: number;
    byCategory: Record<string, number>;
    byNamespace: Record<string, number>;
  };
}

interface Conflict {
  conflictId: string;
  memories: Array<{ id: string; content: string; confidence: number }>;
}

export default function Statistics() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [consolidating, setConsolidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [statusData, conflictsData] = await Promise.all([
        api.getStatus(),
        api.getConflicts(),
      ]);
      setStatus(statusData);
      setConflicts(conflictsData.conflicts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleConsolidate() {
    try {
      setConsolidating(true);
      const result = await api.consolidate({
        detectDuplicates: true,
        detectContradictions: true,
        applyDecay: true,
        cleanupStale: false,
      });
      const r = result.results;
      alert(
        `Consolidation complete!\n\nDuplicates removed: ${r.duplicatesRemoved}\nContradictions: ${r.contradictionsDetected}\nDecayed: ${r.memoriesDecayed}\nDuration: ${r.duration}ms`
      );
      loadData();
    } catch (err) {
      alert(`Consolidation failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setConsolidating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-[10px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  const categoryData = status?.memory?.byCategory || {};
  const namespaceData = status?.memory?.byNamespace || {};
  const total = status?.memory?.total || 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Statistics & Management</h2>
        <button
          onClick={handleConsolidate}
          disabled={consolidating}
          className="px-4 py-2 text-sm font-medium text-white rounded-[10px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {consolidating ? "Consolidating..." : "Run Consolidation"}
        </button>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Memories", value: status?.memory?.total || 0 },
          { label: "With Embeddings", value: status?.memory?.withEmbeddings || 0 },
          {
            label: "Coverage",
            value: `${status?.memory?.total ? ((status.memory.withEmbeddings / status.memory.total) * 100).toFixed(0) : 0}%`,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-[10px] p-5 border border-gray-200/50 dark:border-gray-700/50"
          >
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(var(--text-secondary), 1)" }}>
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-bold">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* By Category */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-base font-semibold mb-4">Memories by Category</h3>
        {Object.keys(categoryData).length === 0 ? (
          <p className="text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>No memories yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(categoryData).map(([category, count]) => {
              const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={category}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium capitalize">{category}</span>
                    <span className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* By Namespace */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-base font-semibold mb-4">Memories by Namespace</h3>
        {Object.keys(namespaceData).length === 0 ? (
          <p className="text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>No memories yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(namespaceData).map(([namespace, count]) => {
              const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={namespace}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{namespace}</span>
                    <span className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Conflicts */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-base font-semibold mb-4">Detected Conflicts</h3>
        {conflicts.length === 0 ? (
          <div className="text-center py-6">
            <svg className="mx-auto h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>No conflicts detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts.map((conflict, index) => (
              <div key={conflict.conflictId} className="border border-yellow-200 dark:border-yellow-800 rounded-[10px] p-4 bg-yellow-50 dark:bg-yellow-900/20">
                <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                  Conflict #{index + 1}
                </h4>
                <div className="space-y-2">
                  {conflict.memories.map((memory, mIndex) => (
                    <div key={memory.id} className="flex items-start gap-2">
                      <span className="flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-yellow-600 text-white text-xs font-medium">
                        {String.fromCharCode(65 + mIndex)}
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {memory.content}
                        <span className="ml-2 text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                          ({(memory.confidence * 100).toFixed(0)}%)
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
