import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api, type AnalyticsOverview, type StaleData, type NeverRecalledData, type DuplicatesData, type TrendsData } from "../lib/api";
import HealthGauge from "../components/HealthGauge";
import TrendsChart from "../components/TrendsChart";
import CategoryChart from "../components/CategoryChart";

const CATEGORY_COLORS: Record<string, string> = {
  preference: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  fact: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  pattern: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  decision: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  outcome: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function Health() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [stale, setStale] = useState<StaleData | null>(null);
  const [neverRecalled, setNeverRecalled] = useState<NeverRecalledData | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicatesData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [ov, st, nr, dup, tr] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getStaleMemories(),
        api.getNeverRecalled(),
        api.getDuplicates(),
        api.getTrends(),
      ]);
      setOverview(ov);
      setStale(st);
      setNeverRecalled(nr);
      setDuplicates(dup);
      setTrends(tr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCleanStale() {
    if (!stale || stale.count === 0) return;
    if (!confirm(`Delete ${stale.count} stale memories? This cannot be undone.`)) return;

    setCleaning(true);
    try {
      const ids = stale.items.map((m) => m.id);
      const result = await api.bulkDeleteMemories(ids);
      setCleanResult(`Deleted ${result.deleted} stale memories`);
      loadData();
    } catch (err) {
      setCleanResult(`Error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setCleaning(false);
    }
  }

  async function handleMergeDuplicates() {
    if (!confirm("Run consolidation to merge duplicate memories?")) return;
    setCleaning(true);
    try {
      const result = await api.consolidate({ detectDuplicates: true });
      setCleanResult(`Removed ${result.results?.duplicatesRemoved || 0} duplicates`);
      loadData();
    } catch (err) {
      setCleanResult(`Error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setCleaning(false);
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
        <button onClick={loadData} className="mt-2 text-sm text-red-700 dark:text-red-300 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <h2 className="text-xl font-semibold">Memory Health</h2>

      {/* Section 1 + 2: Health Score + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-1 glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center"
        >
          <HealthGauge score={overview?.healthScore || 0} />
        </motion.div>
        <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Memories", value: overview?.totalMemories || 0 },
            { label: "Created This Week", value: overview?.createdLast7Days || 0 },
            { label: "Recall Rate", value: `${overview?.recallRate || 0}%` },
            {
              label: "Avg Confidence",
              value: overview?.avgConfidence ? `${Math.round(overview.avgConfidence * 100)}%` : "0%",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-[10px] p-4 border border-gray-200/50 dark:border-gray-700/50"
            >
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-bold">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Section 3 + 4: Category Distribution + Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50"
        >
          <h3 className="text-sm font-medium mb-4" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            Category Distribution
          </h3>
          <CategoryChart data={overview?.byCategory} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50"
        >
          <h3 className="text-sm font-medium mb-4" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            Memories Created (Last 30 Days)
          </h3>
          <TrendsChart data={trends?.daily} />
        </motion.div>
      </div>

      {/* Section 5: Actionable Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InsightCard title="Stale Memories" count={stale?.count || 0} description="Not accessed in 30+ days" color="yellow" />
        <InsightCard title="Never Recalled" count={neverRecalled?.count || 0} description="Zero access since creation" color="orange" />
        <InsightCard
          title="Duplicate Clusters"
          count={duplicates?.clusters?.length || 0}
          description={`${duplicates?.totalDuplicates || 0} redundant memories`}
          color="red"
        />
      </div>

      {/* Section 6: Cleanup Actions */}
      <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-sm font-medium mb-4" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          Cleanup Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCleanStale}
            disabled={cleaning || !stale?.count}
            className="px-4 py-2 text-sm font-medium rounded-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800 dark:hover:bg-yellow-900/40 transition-colors"
          >
            {cleaning ? "Cleaning..." : `Clean ${stale?.count || 0} stale memories`}
          </button>
          <button
            onClick={handleMergeDuplicates}
            disabled={cleaning || !duplicates?.totalDuplicates}
            className="px-4 py-2 text-sm font-medium rounded-[10px] bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/40 transition-colors"
          >
            {cleaning ? "Merging..." : `Merge ${duplicates?.totalDuplicates || 0} duplicates`}
          </button>
        </div>
        {cleanResult && (
          <p className="mt-3 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            {cleanResult}
          </p>
        )}
      </div>

      {/* Stale memories detail */}
      {stale && stale.items.length > 0 && (
        <MemoryTable
          title="Stale Memories"
          items={stale.items as never[]}
          columns={["content", "category", "daysSinceAccess"]}
          columnLabels={{ content: "Content", category: "Category", daysSinceAccess: "Days Stale" }}
        />
      )}

      {/* Never-recalled detail */}
      {neverRecalled && neverRecalled.items.length > 0 && (
        <MemoryTable
          title="Never-Recalled Memories"
          items={neverRecalled.items as never[]}
          columns={["content", "category", "daysSinceCreation"]}
          columnLabels={{ content: "Content", category: "Category", daysSinceCreation: "Days Old" }}
        />
      )}
    </div>
  );
}

function InsightCard({ title, count, description, color }: { title: string; count: number; description: string; color: string }) {
  const colors: Record<string, string> = {
    yellow: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
    orange: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
    red: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
  };
  const textColors: Record<string, string> = {
    yellow: "text-yellow-700 dark:text-yellow-300",
    orange: "text-orange-700 dark:text-orange-300",
    red: "text-red-700 dark:text-red-300",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[10px] border p-4 ${colors[color]}`}
    >
      <p className={`text-2xl font-bold ${textColors[color]}`}>{count}</p>
      <p className={`text-sm font-medium ${textColors[color]}`}>{title}</p>
      <p className="text-xs mt-1" style={{ color: "rgba(var(--text-secondary), 1)" }}>
        {description}
      </p>
    </motion.div>
  );
}

function MemoryTable({
  title,
  items,
  columns,
  columnLabels,
}: {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: Array<Record<string, any>>;
  columns: string[];
  columnLabels: Record<string, string>;
}) {
  return (
    <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
      <h3 className="text-sm font-medium mb-4" style={{ color: "rgba(var(--text-secondary), 1)" }}>
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {columns.map((col) => (
                <th key={col} className="text-left py-2 px-3 text-xs font-medium uppercase" style={{ color: "rgba(var(--text-secondary), 1)" }}>
                  {columnLabels[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 10).map((item, idx) => (
              <tr key={(item.id as string) || idx} className="border-b border-gray-100 dark:border-gray-700/50">
                {columns.map((col) => (
                  <td key={col} className="py-2 px-3 text-gray-700 dark:text-gray-300">
                    {col === "content" ? (
                      <span className="line-clamp-1 max-w-xs block">{String(item[col] ?? "")}</span>
                    ) : col === "category" ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[String(item[col])] || ""}`}>
                        {String(item[col] ?? "")}
                      </span>
                    ) : (
                      String(item[col] ?? "")
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 10 && (
          <p className="text-xs mt-2" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            Showing 10 of {items.length}
          </p>
        )}
      </div>
    </div>
  );
}
