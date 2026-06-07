import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { categoryBadgeClass } from '../utils/categories';

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
    ? 'var(--danger)'
    : pct >= 60
      ? 'var(--warn)'
      : 'var(--text-mid)';
  return (
    <span
      className="badge"
      style={{ color, borderColor: `color-mix(in oklab, ${color} 35%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)`, textTransform: 'none' }}
    >
      {pct}% confidence
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    unresolved: 'var(--warn)',
    resolved: 'var(--success)',
    dismissed: 'var(--text-mid)'
  };
  const color = colors[status] || colors.unresolved;
  return (
    <span
      className="badge"
      style={{ color, borderColor: `color-mix(in oklab, ${color} 35%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)` }}
    >
      {status}
    </span>
  );
}

function MemoryPanel({ memory, label }) {
  if (!memory) {
    return (
      <div className="flex-1 card card--inset p-4">
        <p className="text-sm text-ink-mid italic">Memory deleted</p>
      </div>
    );
  }

  return (
    <div className="flex-1 card card--inset p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="eyebrow">{label}</span>
        <span className={categoryBadgeClass(memory.category)}>
          {memory.category}
        </span>
      </div>
      <p className="text-sm text-ink-hi mb-3">{memory.content}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-mid">
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
    { action: 'keep_first', label: 'Keep A', confirmLabel: 'Click to confirm', color: 'var(--info)' },
    { action: 'keep_second', label: 'Keep B', confirmLabel: 'Click to confirm', color: 'var(--info)' },
    { action: 'keep_both', label: 'Keep Both', confirmLabel: 'Click to confirm', color: 'var(--success)' },
    { action: 'dismiss', label: 'Dismiss', confirmLabel: 'Click to confirm', color: 'var(--text-mid)' }
  ];

  return (
    <div className={`card card--pad ${isResolved ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ConfidenceBadge confidence={contradiction.confidence} />
        <StatusBadge status={contradiction.status} />
        {contradiction.entity && (
          <span className="badge badge--neutral">
            {contradiction.entity}
          </span>
        )}
        {contradiction.resolution_action && (
          <span className="text-xs text-ink-mid ml-auto">
            Resolved: {contradiction.resolution_action.replace('_', ' ')} - {formatTimeAgo(contradiction.resolved_at)}
          </span>
        )}
      </div>

      {/* Reason */}
      {contradiction.reason && (
        <p className="text-sm text-ink-mid mb-4 italic">
          {contradiction.reason}
        </p>
      )}

      {/* Side-by-side memories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <MemoryPanel memory={contradiction.memory1} label="Memory A" />
        <MemoryPanel memory={contradiction.memory2} label="Memory B" />
      </div>

      {/* Detected timestamp */}
      <div className="text-xs text-ink-lo mb-3">
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
              className="btn btn--ghost btn--sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color, borderColor: `color-mix(in oklab, ${color} 35%, transparent)` }}
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
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card card--pad" style={{ borderColor: 'var(--danger)' }}>
        <p style={{ color: 'var(--danger)' }}>Error: {error}</p>
        <button onClick={loadData} className="mt-2 text-sm underline" style={{ color: 'var(--danger)' }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-head flex items-center justify-between" style={{ marginBottom: 0 }}>
        <div>
          <h2>Contradictions</h2>
          <p>Memories that may conflict with each other</p>
        </div>
        {unresolvedCount > 0 && (
          <span
            className="badge"
            style={{ color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)', background: 'color-mix(in oklab, var(--danger) 12%, transparent)', textTransform: 'none' }}
          >
            {unresolvedCount} unresolved
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="card card--pad">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
              className="field"
            >
              <option value="all">All</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <div>
            <label className="field-label">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
              className="field"
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
            <label className="field-label">Sort</label>
            <select
              value={filters.sort}
              onChange={(e) => setFilters(f => ({ ...f, sort: e.target.value }))}
              className="field"
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
        <div className="card card--pad p-12 text-center">
          <svg className="mx-auto h-12 w-12" style={{ color: 'var(--success)' }} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-ink-hi">No contradictions detected</h3>
          <p className="mt-2 text-sm text-ink-mid">Your memory store is consistent.</p>
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
