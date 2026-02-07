import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import CreateMemoryModal from '../components/CreateMemoryModal';

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

  function getCategoryColor(category) {
    const colors = {
      preference: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      fact: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      pattern: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      decision: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      outcome: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Memories
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New Memory
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Namespace
            </label>
            <input
              type="text"
              value={filters.namespace}
              onChange={(e) => setFilters({ ...filters, namespace: e.target.value, offset: 0 })}
              placeholder="Filter by namespace"
              className="w-full px-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value, offset: 0 })}
              className="w-full px-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 focus:outline-none"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Limit
            </label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), offset: 0 })}
              className="w-full px-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 focus:outline-none"
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error: {error}</p>
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No memories found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating a new memory.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New Memory
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {memories.map((memory) => (
              <li key={memory.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {memory.content}
                    </p>
                    <div className="mt-2 flex items-center space-x-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(memory.category)}`}>
                        {memory.category}
                      </span>
                      {memory.entity && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Entity: {memory.entity}
                        </span>
                      )}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Confidence: {(memory.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Accessed: {memory.accessCount}x
                      </span>
                    </div>
                    {memory.tags && memory.tags.length > 0 && (
                      <div className="mt-2 flex items-center space-x-2">
                        {memory.tags.map((tag, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Namespace: {memory.namespace} | ID: {memory.id.substring(0, 8)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(memory.id)}
                    className="ml-4 flex-shrink-0 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {filters.offset + 1}–{Math.min(filters.offset + filters.limit, totalMemories)} of {totalMemories}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
                  disabled={currentPage === 0}
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                        className={`w-8 h-8 text-sm font-medium rounded-md transition-colors ${
                          currentPage === i
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  }
                )}
                {currentPage + 3 < totalPages && (
                  <span className="px-1 text-sm text-gray-400">...</span>
                )}
                <button
                  onClick={() => setFilters(f => ({ ...f, offset: Math.min((totalPages - 1) * f.limit, f.offset + f.limit) }))}
                  disabled={currentPage >= totalPages - 1}
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
