import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import CreateMemoryModal from '../components/CreateMemoryModal';
import { categoryBadgeClass } from '../utils/categories';

export default function MemoryList() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({
    namespace: '',
    category: '',
    limit: 20,
    offset: 0
  });
  const [totalMemories, setTotalMemories] = useState(0);

  useEffect(() => {
    loadMemories();
  }, [filters]);

  async function loadMemories() {
    try {
      setLoading(true);
      const params = {};
      if (filters.namespace) params.namespace = filters.namespace;
      if (filters.category) params.category = filters.category;
      params.limit = filters.limit;
      params.offset = filters.offset;

      const data = await api.getMemories(params);
      setMemories(data.memories || []);
      setTotalMemories(data.pagination?.total ?? data.memories?.length ?? 0);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this memory?')) return;

    try {
      await api.deleteMemory(id);
      loadMemories();
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-head flex justify-between items-center" style={{ marginBottom: 0 }}>
        <h2>Memories</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn--primary"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New Memory
        </button>
      </div>

      {/* Filters */}
      <div className="card card--pad">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="field-label">
              Namespace
            </label>
            <input
              type="text"
              value={filters.namespace}
              onChange={(e) => setFilters({ ...filters, namespace: e.target.value, offset: 0 })}
              placeholder="Filter by namespace"
              className="field"
            />
          </div>
          <div>
            <label className="field-label">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value, offset: 0 })}
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
            <label className="field-label">
              Limit
            </label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), offset: 0 })}
              className="field"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Memory List */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="card card--pad" style={{ borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)' }}>Error: {error}</p>
        </div>
      ) : memories.length === 0 ? (
        <div className="card card--pad text-center py-12">
          <svg className="mx-auto h-12 w-12" style={{ color: 'var(--text-lo)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-ink-hi">No memories found</h3>
          <p className="mt-1 text-sm text-ink-mid">
            Get started by creating a new memory.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn--primary"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New Memory
            </button>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul>
            {memories.map((memory) => (
              <li key={memory.id} className="row" style={{ alignItems: 'flex-start' }}>
                <div className="flex items-start justify-between w-full">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-hi">
                      {memory.content}
                    </p>
                    <div className="mt-2 flex items-center space-x-4">
                      <span className={categoryBadgeClass(memory.category)}>
                        {memory.category}
                      </span>
                      {memory.entity && (
                        <span className="text-sm text-ink-mid">
                          Entity: {memory.entity}
                        </span>
                      )}
                      <span className="text-sm text-ink-mid">
                        Confidence: {(memory.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="text-sm text-ink-mid">
                        Accessed: {memory.accessCount}x
                      </span>
                    </div>
                    {memory.tags && memory.tags.length > 0 && (
                      <div className="mt-2 flex items-center space-x-2">
                        {memory.tags.map((tag, i) => (
                          <span key={i} className="badge badge--neutral">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-ink-lo">
                      Namespace: {memory.namespace} | ID: {memory.id.substring(0, 8)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(memory.id)}
                    className="ml-4 flex-shrink-0"
                    style={{ color: 'var(--danger)' }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pagination */}
      {totalMemories > filters.limit && (
        (() => {
          const totalPages = Math.ceil(totalMemories / filters.limit);
          const currentPage = Math.floor(filters.offset / filters.limit);
          return (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-ink-mid">
                Showing {filters.offset + 1}–{Math.min(filters.offset + filters.limit, totalMemories)} of {totalMemories}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
                  disabled={currentPage === 0}
                  className="btn btn--ghost btn--sm disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from(
                  { length: Math.min(totalPages, currentPage + 3) - Math.max(0, currentPage - 2) },
                  (_, idx) => {
                    const i = Math.max(0, currentPage - 2) + idx;
                    return (
                      <button
                        key={i}
                        onClick={() => setFilters(f => ({ ...f, offset: i * f.limit }))}
                        className={`btn btn--icon ${currentPage === i ? 'btn--primary' : 'btn--ghost'}`}
                      >
                        {i + 1}
                      </button>
                    );
                  }
                )}
                {currentPage + 3 < totalPages && (
                  <span className="px-1 text-sm text-ink-lo">...</span>
                )}
                <button
                  onClick={() => setFilters(f => ({ ...f, offset: Math.min((totalPages - 1) * f.limit, f.offset + f.limit) }))}
                  disabled={currentPage >= totalPages - 1}
                  className="btn btn--ghost btn--sm disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* Create Memory Modal */}
      {showCreateModal && (
        <CreateMemoryModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadMemories();
          }}
        />
      )}
    </div>
  );
}
