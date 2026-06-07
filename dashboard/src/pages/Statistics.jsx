import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { categoryColor } from '../utils/categories';

export default function Statistics() {
  const [status, setStatus] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consolidating, setConsolidating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [statusData, conflictsData] = await Promise.all([
        api.getStatus(),
        api.getConflicts()
      ]);
      setStatus(statusData);
      setConflicts(conflictsData.conflicts || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConsolidate() {
    if (!confirm('Run memory consolidation? This will detect duplicates, apply decay, and find contradictions.')) {
      return;
    }

    try {
      setConsolidating(true);
      const result = await api.consolidate({
        detectDuplicates: true,
        detectContradictions: true,
        applyDecay: true,
        cleanupStale: false
      });

      alert(`Consolidation complete!\n\nDuplicates removed: ${result.results.duplicatesRemoved}\nContradictions detected: ${result.results.contradictionsDetected}\nMemories decayed: ${result.results.memoriesDecayed}\nDuration: ${result.results.duration}ms`);

      loadData();
    } catch (err) {
      alert(`Consolidation failed: ${err.message}`);
    } finally {
      setConsolidating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card card--pad" style={{ borderColor: 'var(--danger)' }}>
        <p style={{ color: 'var(--danger)' }}>Error: {error}</p>
      </div>
    );
  }

  const categoryData = status?.memory?.byCategory || {};
  const namespaceData = status?.memory?.byNamespace || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display font-bold text-ink-hi">
          Statistics & Management
        </h2>
        <button
          onClick={handleConsolidate}
          disabled={consolidating}
          className="btn btn--primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {consolidating ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Consolidating...
            </>
          ) : (
            <>
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Run Consolidation
            </>
          )}
        </button>
      </div>

      {/* Memory Distribution by Category */}
      <div className="card card--pad">
        <h3 className="text-lg font-display font-medium text-ink-hi mb-4">
          Memories by Category
        </h3>
        {Object.keys(categoryData).length === 0 ? (
          <p className="text-ink-mid">No memories yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(categoryData).map(([category, count]) => {
              const total = status.memory.total;
              const percentage = ((count / total) * 100).toFixed(1);
              return (
                <div key={category}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-ink-hi capitalize">
                      {category}
                    </span>
                    <span className="text-sm text-ink-mid">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${percentage}%`, background: categoryColor(category) }}></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Memory Distribution by Namespace */}
      <div className="card card--pad">
        <h3 className="text-lg font-display font-medium text-ink-hi mb-4">
          Memories by Namespace
        </h3>
        {Object.keys(namespaceData).length === 0 ? (
          <p className="text-ink-mid">No memories yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(namespaceData).map(([namespace, count]) => {
              const total = status.memory.total;
              const percentage = ((count / total) * 100).toFixed(1);
              return (
                <div key={namespace}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-ink-hi">
                      {namespace}
                    </span>
                    <span className="text-sm text-ink-mid">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${percentage}%`, background: 'var(--success)' }}></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Conflicts */}
      <div className="card card--pad">
        <h3 className="text-lg font-display font-medium text-ink-hi mb-4">
          Detected Conflicts
        </h3>
        {conflicts.length === 0 ? (
          <div className="text-center py-6">
            <svg className="mx-auto h-12 w-12 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2 text-sm text-ink-mid">No conflicts detected</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conflicts.map((conflict, index) => (
              <div
                key={conflict.conflictId}
                className="rounded-lg p-4"
                style={{
                  border: '1px solid color-mix(in oklab, var(--warn) 35%, transparent)',
                  background: 'color-mix(in oklab, var(--warn) 12%, transparent)'
                }}
              >
                <h4 className="text-sm font-medium text-warn mb-2">
                  Conflict #{index + 1}
                </h4>
                <div className="space-y-2">
                  {conflict.memories.map((memory, mIndex) => (
                    <div key={memory.id} className="flex items-start">
                      <span
                        className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium"
                        style={{ background: 'var(--warn)', color: 'var(--bg-app)' }}
                      >
                        {String.fromCharCode(65 + mIndex)}
                      </span>
                      <p className="ml-3 text-sm text-ink-hi">
                        {memory.content}
                        <span className="ml-2 text-xs text-ink-mid">
                          (confidence: {(memory.confidence * 100).toFixed(0)}%)
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

      {/* System Health */}
      <div className="card card--pad">
        <h3 className="text-lg font-display font-medium text-ink-hi mb-4">
          System Health
        </h3>
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card card--inset px-4 py-5 overflow-hidden">
            <dt className="text-sm font-medium text-ink-mid truncate">
              Total Memories
            </dt>
            <dd className="mt-1 text-3xl font-display font-semibold text-ink-hi">
              {status?.memory?.total || 0}
            </dd>
          </div>
          <div className="card card--inset px-4 py-5 overflow-hidden">
            <dt className="text-sm font-medium text-ink-mid truncate">
              With Embeddings
            </dt>
            <dd className="mt-1 text-3xl font-display font-semibold text-ink-hi">
              {status?.memory?.withEmbeddings || 0}
            </dd>
          </div>
          <div className="card card--inset px-4 py-5 overflow-hidden">
            <dt className="text-sm font-medium text-ink-mid truncate">
              Coverage
            </dt>
            <dd className="mt-1 text-3xl font-display font-semibold text-ink-hi">
              {status?.memory?.total > 0
                ? ((status.memory.withEmbeddings / status.memory.total) * 100).toFixed(0)
                : 0}%
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
