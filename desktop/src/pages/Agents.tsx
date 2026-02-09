import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api, Memory } from "../lib/api";

const SOURCE_COLORS: Record<string, string> = {
  cli: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  mcp: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  api: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  manual: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  import: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300",
  desktop: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
};

const SOURCE_LABELS: Record<string, string> = {
  cli: "CLI",
  mcp: "MCP",
  api: "REST API",
  manual: "Manual",
  import: "Import",
  desktop: "Desktop",
};

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return "Never";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface SourceData {
  count: number;
  namespaces: Set<string>;
  categories: Record<string, number>;
  lastActivity: number;
}

interface NamespaceData {
  count: number;
  sources: Set<string>;
  categories: Record<string, number>;
  totalAccess: number;
  lastActivity: number;
}

export default function Agents() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const data = await api.getMemories({ limit: 1000 });
      setMemories(data.memories || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
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
      </div>
    );
  }

  // Analyze by source
  const bySource: Record<string, SourceData> = {};
  for (const m of memories) {
    const source = m.source || "manual";
    if (!bySource[source]) {
      bySource[source] = { count: 0, namespaces: new Set(), categories: {}, lastActivity: 0 };
    }
    bySource[source].count++;
    bySource[source].namespaces.add(m.namespace);
    bySource[source].categories[m.category] = (bySource[source].categories[m.category] || 0) + 1;
    const activity = m.lastAccessed || m.createdAt;
    if (activity > bySource[source].lastActivity) bySource[source].lastActivity = activity;
  }

  // Analyze by namespace
  const byNamespace: Record<string, NamespaceData> = {};
  for (const m of memories) {
    const ns = m.namespace || "default";
    if (!byNamespace[ns]) {
      byNamespace[ns] = { count: 0, sources: new Set(), categories: {}, totalAccess: 0, lastActivity: 0 };
    }
    byNamespace[ns].count++;
    byNamespace[ns].sources.add(m.source || "manual");
    byNamespace[ns].categories[m.category] = (byNamespace[ns].categories[m.category] || 0) + 1;
    byNamespace[ns].totalAccess += m.accessCount || 0;
    const activity = m.lastAccessed || m.createdAt;
    if (activity > byNamespace[ns].lastActivity) byNamespace[ns].lastActivity = activity;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="text-xl font-semibold">Agent Integrations</h2>
        <p className="mt-1 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          Overview of agents and interfaces using Engram for persistent memory
        </p>
      </div>

      {/* Active Sources */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-base font-semibold mb-4">Active Integration Sources</h3>
        {Object.keys(bySource).length === 0 ? (
          <p className="text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>No activity yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(bySource).map(([source, data], i) => (
              <motion.div
                key={source}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="border border-gray-200 dark:border-gray-700 rounded-[10px] p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${SOURCE_COLORS[source] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}`}>
                    {SOURCE_LABELS[source] || source}
                  </span>
                  <span className="text-2xl font-bold">{data.count}</span>
                </div>
                <div className="space-y-1 text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                  <p>Namespaces: {data.namespaces.size}</p>
                  <p>Categories: {Object.keys(data.categories).length}</p>
                  <p>Last active: {formatRelativeTime(data.lastActivity)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Namespaces */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-base font-semibold mb-2">Agent Namespaces</h3>
        <p className="text-sm mb-4" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          Each namespace represents a separate agent instance or context.
        </p>
        {Object.keys(byNamespace).length === 0 ? (
          <p className="text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>No namespaces yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(byNamespace).map(([ns, data]) => {
              const avgAccess = data.count > 0 ? data.totalAccess / data.count : 0;
              return (
                <div key={ns} className="border border-gray-200 dark:border-gray-700 rounded-[10px] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">{ns}</h4>
                    <span className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                      {data.count} memories
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div>
                      <p style={{ color: "rgba(var(--text-secondary), 1)" }}>Sources</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Array.from(data.sources).map((src) => (
                          <span
                            key={src}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[src] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}`}
                          >
                            {SOURCE_LABELS[src] || src}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ color: "rgba(var(--text-secondary), 1)" }}>Top categories</p>
                      <p className="mt-1">
                        {Object.entries(data.categories)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 2)
                          .map(([cat, count]) => `${cat} (${count})`)
                          .join(", ")}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "rgba(var(--text-secondary), 1)" }}>Avg Access</p>
                      <p className="mt-1">{avgAccess.toFixed(1)}x</p>
                    </div>
                    <div>
                      <p style={{ color: "rgba(var(--text-secondary), 1)" }}>Last Active</p>
                      <p className="mt-1">{formatRelativeTime(data.lastActivity)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integration Guide */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-base font-semibold mb-4">Integration Methods</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-1">1. MCP Integration (Claude Desktop/Code)</h4>
            <p style={{ color: "rgba(var(--text-secondary), 1)" }}>
              Add Engram to your Claude Desktop configuration. Claude will automatically use engram_remember and engram_recall tools.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">2. REST API Integration</h4>
            <p style={{ color: "rgba(var(--text-secondary), 1)" }}>
              Use the REST API from any programming language. Create memories with custom namespaces for each agent.
            </p>
            <code className="block mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
              POST http://localhost:3838/api/memories {`{"namespace": "my-agent"}`}
            </code>
          </div>
          <div>
            <h4 className="font-medium mb-1">3. CLI Integration</h4>
            <p style={{ color: "rgba(var(--text-secondary), 1)" }}>
              Call Engram CLI from your agent&apos;s code or scripts. Perfect for shell-based agents.
            </p>
            <code className="block mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
              engram remember &quot;...&quot; --namespace my-agent
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
