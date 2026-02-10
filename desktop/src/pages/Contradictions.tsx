import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api, type Contradiction, type ContradictionMemory } from "../lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  preference: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  fact: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  pattern: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  decision: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  outcome: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80
      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      : pct >= 60
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {pct}% confidence
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    unresolved: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    dismissed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.unresolved}`}>
      {status}
    </span>
  );
}

function MemoryPanel({ memory, label }: { memory: ContradictionMemory | null; label: string }) {
  if (!memory) {
    return (
      <div className="flex-1 p-4 rounded-[10px] bg-gray-50 dark:bg-gray-700/30 border border-gray-200/50 dark:border-gray-600/50">
        <p className="text-sm italic" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          Memory deleted
        </p>
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.fact;

  return (
    <div className="flex-1 p-4 rounded-[10px] bg-gray-50 dark:bg-gray-700/30 border border-gray-200/50 dark:border-gray-600/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          {label}
        </span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${catColor}`}>
          {memory.category}
        </span>
      </div>
      <p className="text-sm mb-3">{memory.content}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
        <span>Confidence: {Math.round(memory.confidence * 100)}%</span>
        <span>Created: {formatTimeAgo(memory.created_at)}</span>
        {memory.source && <span>Source: {memory.source}</span>}
      </div>
    </div>
  );
}

const ACTION_BUTTONS = [
  {
    action: "keep_first",
    label: "Keep A",
    confirmLabel: "Click to confirm",
    color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/40",
  },
  {
    action: "keep_second",
    label: "Keep B",
    confirmLabel: "Click to confirm",
    color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/40",
  },
  {
    action: "keep_both",
    label: "Keep Both",
    confirmLabel: "Click to confirm",
    color: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/40",
  },
  {
    action: "dismiss",
    label: "Dismiss",
    confirmLabel: "Click to confirm",
    color: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-700/30 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700/50",
  },
];

function ConflictCard({
  contradiction,
  onResolve,
  resolving,
  confirmAction,
  onConfirmAction,
}: {
  contradiction: Contradiction;
  onResolve: (id: string, action: string) => void;
  resolving: string | null;
  confirmAction: { id: string; action: string } | null;
  onConfirmAction: (v: { id: string; action: string } | null) => void;
}) {
  const isResolving = resolving === contradiction.id;
  const isResolved = contradiction.status !== "unresolved";

  function handleAction(action: string) {
    if (confirmAction && confirmAction.id === contradiction.id && confirmAction.action === action) {
      onResolve(contradiction.id, action);
      onConfirmAction(null);
    } else {
      onConfirmAction({ id: contradiction.id, action });
    }
  }

  const isConfirming = (action: string) =>
    confirmAction && confirmAction.id === contradiction.id && confirmAction.action === action;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50 ${isResolved ? "opacity-60" : ""}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ConfidenceBadge confidence={contradiction.confidence} />
        <StatusBadge status={contradiction.status} />
        {contradiction.entity && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
            {contradiction.entity}
          </span>
        )}
        {contradiction.resolution_action && (
          <span className="text-xs ml-auto" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            Resolved: {contradiction.resolution_action.replace("_", " ")} -{" "}
            {formatTimeAgo(contradiction.resolved_at!)}
          </span>
        )}
      </div>

      {/* Reason */}
      {contradiction.reason && (
        <p className="text-sm italic mb-4" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          {contradiction.reason}
        </p>
      )}

      {/* Side-by-side memories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <MemoryPanel memory={contradiction.memory1} label="Memory A" />
        <MemoryPanel memory={contradiction.memory2} label="Memory B" />
      </div>

      {/* Detected timestamp */}
      <div className="text-xs mb-3" style={{ color: "rgba(var(--text-secondary), 1)" }}>
        Detected {formatTimeAgo(contradiction.detected_at)}
      </div>

      {/* Action buttons */}
      {!isResolved && (
        <div className="flex flex-wrap gap-2">
          {ACTION_BUTTONS.map(({ action, label, confirmLabel, color }) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              disabled={isResolving}
              className={`px-3 py-1.5 text-sm font-medium rounded-[10px] border ${color} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              {isResolving && isConfirming(action) ? (
                <span className="inline-flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Resolving...
                </span>
              ) : isConfirming(action) ? (
                confirmLabel
              ) : (
                label
              )}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function Contradictions() {
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string } | null>(null);
  const [filters, setFilters] = useState({
    status: "unresolved",
    category: "",
    sort: "detected_at",
  });

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filters.status && filters.status !== "all") params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.sort) params.sort = filters.sort;

      const data = await api.getContradictions(params);
      setContradictions(data.contradictions || []);
      setUnresolvedCount(data.unresolvedCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contradictions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filters.status, filters.category, filters.sort]);

  async function handleResolve(id: string, action: string) {
    setResolving(id);
    try {
      await api.resolveContradiction(id, action);
    } catch {
      // Contradiction may have been cascade-deleted when a related memory was removed — not an error
    } finally {
      setConfirmAction(null);
      setResolving(null);
      await loadData();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Contradictions</h2>
          <p className="mt-1 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            Memories that may conflict with each other
          </p>
        </div>
        {unresolvedCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            {unresolvedCount} unresolved
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="glass rounded-[10px] p-4 border border-gray-200/50 dark:border-gray-700/50">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "rgba(var(--text-secondary), 1)" }}>
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-[10px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "rgba(var(--text-secondary), 1)" }}>
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-[10px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="preference">Preference</option>
              <option value="fact">Fact</option>
              <option value="pattern">Pattern</option>
              <option value="decision">Decision</option>
              <option value="outcome">Outcome</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "rgba(var(--text-secondary), 1)" }}>
              Sort
            </label>
            <select
              value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-[10px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="detected_at">Newest First</option>
              <option value="detected_at_asc">Oldest First</option>
              <option value="confidence">Highest Confidence</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contradiction list or empty state */}
      {contradictions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-[10px] p-12 border border-gray-200/50 dark:border-gray-700/50 text-center"
        >
          <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium">No contradictions detected</h3>
          <p className="mt-2 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            Your memory store is consistent.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {contradictions.map((c) => (
            <ConflictCard
              key={c.id}
              contradiction={c}
              onResolve={handleResolve}
              resolving={resolving}
              confirmAction={confirmAction}
              onConfirmAction={setConfirmAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
