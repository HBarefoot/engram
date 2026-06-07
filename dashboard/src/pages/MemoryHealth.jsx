import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import HealthGauge from '../components/HealthGauge';
import TrendsChart from '../components/TrendsChart';
import CategoryChart from '../components/CategoryChart';
import { categoryBadgeClass } from '../utils/categories';

export default function MemoryHealth() {
  const [overview, setOverview] = useState(null);
  const [stale, setStale] = useState(null);
  const [neverRecalled, setNeverRecalled] = useState(null);
  const [duplicates, setDuplicates] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmCleanNeverRecalled, setConfirmCleanNeverRecalled] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [ov, st, nr, dup, tr] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getStaleMemories(),
        api.getNeverRecalled(),
        api.getDuplicates(),
        api.getTrends()
      ]);
      setOverview(ov);
      setStale(st);
      setNeverRecalled(nr);
      setDuplicates(dup);
      setTrends(tr);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleCleanStale() {
    if (!stale || stale.items.length === 0) return;
    if (!confirm(`Delete ${stale.items.length} stale memories? This cannot be undone.`)) return;

    setCleaning(true);
    try {
      const ids = stale.items.map(m => m.id);
      const result = await api.bulkDeleteMemories(ids);
      setCleanResult(`Deleted ${result.deleted} stale memories`);
      loadData();
    } catch (err) {
      setCleanResult(`Error: ${err.message}`);
    } finally {
      setCleaning(false);
    }
  }

  async function handleCleanNeverRecalled() {
    if (!neverRecalled || neverRecalled.items.length === 0) return;
    if (!confirmCleanNeverRecalled) {
      setConfirmCleanNeverRecalled(true);
      return;
    }
    setConfirmCleanNeverRecalled(false);
    setCleaning(true);
    try {
      const ids = neverRecalled.items.map(m => m.id);
      const result = await api.bulkDeleteMemories(ids);
      setCleanResult(`Deleted ${result.deleted} never-recalled memories`);
      loadData();
    } catch (err) {
      setCleanResult(`Error: ${err.message}`);
    } finally {
      setCleaning(false);
    }
  }

  async function handleDeleteSingle(id) {
    setDeletingId(id);
    try {
      await api.deleteMemory(id);
      loadData();
    } catch (err) {
      setCleanResult(`Error deleting memory: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMergeDuplicates() {
    if (!confirm('Run consolidation to merge duplicate memories?')) return;
    setCleaning(true);
    try {
      // Use the same threshold the analytics duplicate-cluster query
       // uses (0.85), otherwise the merge runs at consolidate.js's stricter
       // default of 0.92 and reports 0 removed for clusters in the 0.85–0.92 band.
      const result = await api.consolidate({
        detectDuplicates: true,
        duplicateThreshold: 0.85
      });
      setCleanResult(`Removed ${result.results?.duplicatesRemoved || 0} duplicates`);
      loadData();
    } catch (err) {
      setCleanResult(`Error: ${err.message}`);
    } finally {
      setCleaning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card card--pad" style={{ borderColor: 'var(--danger)' }}>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
        <button onClick={loadData} className="mt-2 text-sm underline" style={{ color: 'var(--danger)' }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h2>Memory Health</h2>
      </div>

      {/* Section 1 + 2: Health Score + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-1 card card--pad flex items-center justify-center">
          <HealthGauge score={overview?.healthScore || 0} />
        </div>
        <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Memories" value={overview?.totalMemories || 0} />
          <StatCard label="Created This Week" value={overview?.createdLast7Days || 0} />
          <StatCard label="Recall Rate" value={`${overview?.recallRate || 0}%`} />
          <StatCard
            label="Avg Confidence"
            value={overview?.avgConfidence ? `${Math.round(overview.avgConfidence * 100)}%` : '0%'}
          />
        </div>
      </div>

      {/* Section 3 + 4: Category Distribution + Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card card--pad">
          <h2 className="eyebrow mb-4">Category Distribution</h2>
          <CategoryChart data={overview?.byCategory} />
        </div>
        <div className="card card--pad">
          <h2 className="eyebrow mb-4">Memories Created (Last 30 Days)</h2>
          <TrendsChart data={trends?.daily} />
        </div>
      </div>

      {/* Section 5: Actionable Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InsightCard
          title="Stale Memories"
          count={stale?.count || 0}
          description="Not accessed in 30+ days"
          color="yellow"
        />
        <InsightCard
          title="Never Recalled"
          count={neverRecalled?.count || 0}
          description="Zero access since creation"
          color="orange"
        />
        <InsightCard
          title="Duplicate Clusters"
          count={duplicates?.clusters?.length || 0}
          description={`${duplicates?.totalDuplicates || 0} redundant memories`}
          color="red"
        />
      </div>

      {/* Section 6: Cleanup Actions */}
      <div className="card card--pad">
        <h2 className="eyebrow mb-4">Cleanup Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCleanStale}
            disabled={cleaning || !stale?.count}
            className="btn btn--ghost disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--warn)', borderColor: 'color-mix(in oklab, var(--warn) 35%, transparent)' }}
          >
            {cleaning ? 'Cleaning...' : `Clean ${stale?.count || 0} stale memories`}
          </button>
          <button
            onClick={handleCleanNeverRecalled}
            disabled={cleaning || !neverRecalled?.count}
            className="btn btn--ghost disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--warn)', borderColor: 'color-mix(in oklab, var(--warn) 35%, transparent)' }}
          >
            {cleaning ? 'Cleaning...' : confirmCleanNeverRecalled
              ? `Confirm delete ${neverRecalled?.count || 0}?`
              : `Clean ${neverRecalled?.count || 0} never-recalled`}
          </button>
          {confirmCleanNeverRecalled && (
            <button
              onClick={() => setConfirmCleanNeverRecalled(false)}
              className="btn btn--ghost"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleMergeDuplicates}
            disabled={cleaning || !duplicates?.totalDuplicates}
            className="btn btn--ghost disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)' }}
          >
            {cleaning ? 'Merging...' : `Merge ${duplicates?.totalDuplicates || 0} duplicates`}
          </button>
        </div>
        {cleanResult && (
          <p className="mt-3 text-sm text-ink-mid">{cleanResult}</p>
        )}
      </div>

      {/* Stale memories detail */}
      {stale && stale.items.length > 0 && (
        <MemoryTable
          title="Stale Memories"
          items={stale.items}
          columns={['content', 'category', 'daysSinceAccess']}
          columnLabels={{ content: 'Content', category: 'Category', daysSinceAccess: 'Days Stale' }}
        />
      )}

      {/* Never-recalled detail */}
      {neverRecalled && neverRecalled.items.length > 0 && (
        <MemoryTable
          title="Never-Recalled Memories"
          items={neverRecalled.items}
          columns={['content', 'category', 'daysSinceCreation']}
          columnLabels={{ content: 'Content', category: 'Category', daysSinceCreation: 'Days Old' }}
          onDelete={handleDeleteSingle}
          deletingId={deletingId}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      <p className="stat__value text-ink-hi">{value}</p>
    </div>
  );
}

function InsightCard({ title, count, description, color }) {
  const colorVars = {
    yellow: 'var(--warn)',
    orange: 'var(--warn)',
    red: 'var(--danger)'
  };
  const c = colorVars[color] || 'var(--text-mid)';

  return (
    <div
      className="card card--pad"
      style={{ borderColor: `color-mix(in oklab, ${c} 35%, transparent)`, background: `color-mix(in oklab, ${c} 8%, var(--surface-1))` }}
    >
      <p className="text-2xl font-bold" style={{ color: c }}>{count}</p>
      <p className="text-sm font-medium" style={{ color: c }}>{title}</p>
      <p className="text-xs text-ink-mid mt-1">{description}</p>
    </div>
  );
}

function MemoryTable({ title, items, columns, columnLabels, onDelete, deletingId }) {
  return (
    <div className="card card--pad">
      <h2 className="eyebrow mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>
                  {columnLabels[col]}
                </th>
              ))}
              {onDelete && (
                <th className="text-right w-20">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 10).map(item => (
              <tr key={item.id}>
                {columns.map(col => (
                  <td key={col} className={col === 'content' ? 'hi' : ''}>
                    {col === 'content' ? (
                      <span className="line-clamp-1 max-w-xs">{item[col]}</span>
                    ) : col === 'category' ? (
                      <span className={categoryBadgeClass(item[col])}>
                        {item[col]}
                      </span>
                    ) : (
                      item[col]
                    )}
                  </td>
                ))}
                {onDelete && (
                  <td className="text-right">
                    <button
                      onClick={() => onDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="btn btn--ghost btn--sm disabled:opacity-50"
                      style={{ color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)' }}
                    >
                      {deletingId === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 10 && (
          <p className="text-xs text-ink-mid mt-2">Showing 10 of {items.length}</p>
        )}
      </div>
    </div>
  );
}
