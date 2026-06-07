import { useState } from 'react';
import { api } from '../utils/api';
import { categoryBadgeClass } from '../utils/categories';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-head">
        <h2>Search Memories</h2>
        <p>
          Use hybrid search to find relevant memories based on semantic similarity, recency, and confidence.
        </p>
      </div>

      {/* Search Form */}
      <div className="card card--pad">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="field-label">
              Search Query
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you want to remember?"
              className="field text-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">
                Max Results
              </label>
              <select
                value={options.limit}
                onChange={(e) => setOptions({ ...options, limit: parseInt(e.target.value) })}
                className="field"
              >
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </div>
            <div>
              <label className="field-label">
                Threshold
              </label>
              <select
                value={options.threshold}
                onChange={(e) => setOptions({ ...options, threshold: parseFloat(e.target.value) })}
                className="field"
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
            className="btn btn--primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="card card--pad" style={{ borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)' }}>Error: {error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-ink-hi">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </h3>
          <div className="card overflow-hidden">
            <ul>
              {results.map((memory, index) => (
                <li key={memory.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="flex items-start w-full">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full font-bold mono" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        #{index + 1}
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-base font-medium text-ink-hi">
                        {memory.content}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className={categoryBadgeClass(memory.category)}>
                          {memory.category}
                        </span>
                        {memory.entity && (
                          <span className="text-sm text-ink-mid">
                            Entity: {memory.entity}
                          </span>
                        )}
                        <span className="text-sm text-ink-mid">
                          Score: {memory.score.toFixed(3)}
                        </span>
                        <span className="text-sm text-ink-mid">
                          Confidence: {(memory.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      {memory.scoreBreakdown && (
                        <div className="card card--inset mt-3 p-3">
                          <p className="text-xs font-medium text-ink-mid mb-2">
                            Score Breakdown:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                            <div>
                              <span className="text-ink-lo">Similarity:</span>
                              <span className="ml-1 font-medium text-ink-hi mono">
                                {memory.scoreBreakdown.similarity.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-ink-lo">Recency:</span>
                              <span className="ml-1 font-medium text-ink-hi mono">
                                {memory.scoreBreakdown.recency.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-ink-lo">Confidence:</span>
                              <span className="ml-1 font-medium text-ink-hi mono">
                                {memory.scoreBreakdown.confidence.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-ink-lo">Access:</span>
                              <span className="ml-1 font-medium text-ink-hi mono">
                                {memory.scoreBreakdown.access.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-ink-lo">FTS Boost:</span>
                              <span className="ml-1 font-medium text-ink-hi mono">
                                {memory.scoreBreakdown.ftsBoost.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-ink-lo">
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
        <div className="card card--pad text-center py-12">
          <svg className="mx-auto h-12 w-12" style={{ color: 'var(--text-lo)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-ink-hi">No results found</h3>
          <p className="mt-1 text-sm text-ink-mid">
            Try adjusting your search query or threshold.
          </p>
        </div>
      )}
    </div>
  );
}
