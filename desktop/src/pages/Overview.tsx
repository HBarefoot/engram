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
  model: {
    name: string;
    available: boolean;
    cached: boolean;
    loading: boolean;
    size: number;
  };
  config?: {
    dataDir?: string;
    defaultNamespace?: string;
    recallLimit?: number;
    secretDetection?: boolean;
  };
}

export default function Overview() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      const data = await api.getStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
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
        <button onClick={loadStatus} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const stats = [
    { label: "Total Memories", value: status?.memory?.total || 0, color: "blue" },
    { label: "With Embeddings", value: status?.memory?.withEmbeddings || 0, color: "green" },
    { label: "Categories", value: Object.keys(status?.memory?.byCategory || {}).length, color: "purple" },
    { label: "Namespaces", value: Object.keys(status?.memory?.byNamespace || {}).length, color: "cyan" },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Welcome header */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h2 className="text-xl font-semibold">Welcome to Engram</h2>
        <p className="mt-1 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          Persistent memory for AI agents — SQLite for agent state
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
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

      {/* Model Info */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-base font-semibold mb-4">Embedding Model</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>Name</p>
            <p className="text-sm font-medium mt-1">{status?.model?.name || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>Status</p>
            <p className="text-sm font-medium mt-1">
              {status?.model?.available ? (
                <span className="text-green-600 dark:text-green-400">Available</span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400">Not Available</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>Cached</p>
            <p className="text-sm font-medium mt-1">{status?.model?.cached ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>Size</p>
            <p className="text-sm font-medium mt-1">{status?.model?.size || 0} MB</p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-base font-semibold mb-4">Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>Data Directory</p>
            <p className="text-sm font-mono mt-1">{status?.config?.dataDir || "~/.engram"}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>Default Namespace</p>
            <p className="text-sm mt-1">{status?.config?.defaultNamespace || "default"}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>Recall Limit</p>
            <p className="text-sm mt-1">{status?.config?.recallLimit || 5}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>Secret Detection</p>
            <p className="text-sm mt-1">
              {status?.config?.secretDetection !== false ? (
                <span className="text-green-600 dark:text-green-400">Enabled</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">Disabled</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
