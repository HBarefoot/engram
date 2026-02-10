import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const CATEGORY_COLORS = {
  preference: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  fact: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  pattern: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  decision: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  outcome: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function ConfidenceBadge({ confidence }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80
    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    : pct >= 60
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {pct}% confidence
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    unresolved: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    dismissed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || colors.unresolved}`}>
      {status}
    </span>
  );
}

function MemoryPanel({ memory, label }) {
  if (!memory) {
    return (
      <div className="flex-1 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">Memory deleted</p>
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.fact;

  return (
    <div className="flex-1 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{label}</span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${catColor}`}>
          {memory.category}
        </span>
      </div>
      <p className="text-sm text-gray-900 dark:text-gray-100 mb-3">{memory.content}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Confidence: {Math.round(memory.confidence * 100)}%</span>
        <span>Created: {formatTimeAgo(memory.created_at)}</span>
        {memory.source && <span>Source: {memory.source}</span>}
      </div>
    </div>
  );
}

function ConflictCard({ contradiction, onResolve, resolving, confirmAction, onConfirmAction }) {
  const isResolving = resolving === contradiction.id;
  const isResolved = contradiction.status !== 'unresolved';

  function handleAction(action) {
    if (confirmAction && confirmAction.id === contradiction.id && confirmAction.action === action) {
      onResolve(contradiction.id, action);
      onConfirmAction(null);
    } else {
      onConfirmAction({ id: contradiction.id, action });
    }
  }

  const isConfirming = (action) =>
    confirmAction && confirmAction.id === contradiction.id && confirmAction.action === action;

  const actionButtons = [
    { action: 'keep_first', label: 'Keep A', confirmLabel: 'Click to confirm', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/50' },
    { action: 'keep_second', label: 'Keep B', confirmLabel: 'Click to confirm', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/50' },
    { action: 'keep_both', label: 'Keep Both', confirmLabel: 'Click to confirm', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-900/50' },
    { action: 'dismiss', label: 'Dismiss', confirmLabel: 'Click to confirm', color: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700' }
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 shadow rounded-lg p-6 ${isResolved ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ConfidenceBadge confidence={contradiction.confidence} />
        <StatusBadge status={contradiction.status} />
        {contradiction.entity && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
            {contradiction.entity}
          </span>
        )}
        {contradiction.resolution_action && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            Resolved: {contradiction.resolution_action.replace('_', ' ')} - {formatTimeAgo(contradiction.resolved_at)}
          </span>
        )}
      </div>

      {/* Reason */}
      {contradiction.reason && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 italic">
          {contradiction.reason}
        </p>
      )}

      {/* Side-by-side memories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <MemoryPanel memory={contradiction.memory1} label="Memory A" />
        <MemoryPanel memory={contradiction.memory2} label="Memory B" />
      </div>

      {/* Detected timestamp */}
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        Detected {formatTimeAgo(contradiction.detected_at)}
      </div>

      {/* Action buttons */}
      {!isResolved && (
        <div className="flex flex-wrap gap-2">
          {actionButtons.map(({ action, label, confirmLabel, color }) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              disabled={isResolving}
              className={`px-3 py-1.5 text-sm font-medium rounded-md border ${color} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              {isResolving && isConfirming(action) ? (
                <span className="inline-flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Resolving...
                </span>
              ) : isConfirming(action) ? confirmLabel : label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Contradictions() {
  const [contradictions, setContradictions] = useState([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [filters, setFilters] = useState({
    status: 'unresolved',
    category: '',
    sort: 'detected_at'
  });

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.sort) params.sort = filters.sort;

      const data = await api.getContradictions(params);
      setContradictions(data.contradictions || []);
      setUnresolvedCount(data.unresolvedCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [filters.status, filters.category, filters.sort]);

  async function handleResolve(id, action) {
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
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">Error: {error}</p>
        <button onClick={loadData} className="mt-2 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Contradictions</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Memories that may conflict with each other
          </p>
        </div>
        {unresolvedCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            {unresolvedCount} unresolved
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="all">All</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
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
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sort</label>
            <select
              value={filters.sort}
              onChange={(e) => setFilters(f => ({ ...f, sort: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
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
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No contradictions detected</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Your memory store is consistent.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contradictions.map(c => (
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
