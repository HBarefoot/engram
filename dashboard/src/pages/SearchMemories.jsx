import { useState } from 'react';
import { api } from '../utils/api';

export default function SearchMemories() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState({
    limit: 5,
    threshold: 0.3
  });

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.searchMemories(query, options);
      setResults(data.memories || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Search Memories
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Use hybrid search to find relevant memories based on semantic similarity, recency, and confidence.
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Query
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you want to remember?"
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 text-lg p-3"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Results
              </label>
              <select
                value={options.limit}
                onChange={(e) => setOptions({ ...options, limit: parseInt(e.target.value) })}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Threshold
              </label>
              <select
                value={options.threshold}
                onChange={(e) => setOptions({ ...options, threshold: parseFloat(e.target.value) })}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="0.1">0.1 (Low)</option>
                <option value="0.3">0.3 (Medium)</option>
                <option value="0.5">0.5 (High)</option>
                <option value="0.7">0.7 (Very High)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </>
            )}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error: {error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </h3>
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {results.map((memory, index) => (
                <li key={memory.id} className="p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 font-bold">
                        #{index + 1}
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-base font-medium text-gray-900 dark:text-white">
                        {memory.content}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(memory.category)}`}>
                          {memory.category}
                        </span>
                        {memory.entity && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Entity: {memory.entity}
                          </span>
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Score: {memory.score.toFixed(3)}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Confidence: {(memory.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      {memory.scoreBreakdown && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Score Breakdown:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Similarity:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                {memory.scoreBreakdown.similarity.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Recency:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                {memory.scoreBreakdown.recency.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Confidence:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                {memory.scoreBreakdown.confidence.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Access:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                {memory.scoreBreakdown.access.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">FTS Boost:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                {memory.scoreBreakdown.ftsBoost.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Namespace: {memory.namespace} | Accessed: {memory.accessCount}x | ID: {memory.id.substring(0, 8)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && !error && results.length === 0 && query && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No results found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your search query or threshold.
          </p>
        </div>
      )}
    </div>
  );
}
