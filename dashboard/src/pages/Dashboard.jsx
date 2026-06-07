import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      const data = await api.getStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        <button
          onClick={loadStatus}
          className="mt-2 text-sm hover:underline"
          style={{ color: 'var(--danger)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-head">
        <h2>Welcome to Engram</h2>
        <p>Persistent memory for AI agents - SQLite for agent state</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-ink-lo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="stat__label truncate">Total Memories</dt>
                <dd className="stat__value text-ink-hi" style={{ fontSize: '24px', marginTop: '4px' }}>
                  {status?.memory?.total || 0}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="stat">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-ink-lo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="stat__label truncate">With Embeddings</dt>
                <dd className="stat__value text-ink-hi" style={{ fontSize: '24px', marginTop: '4px' }}>
                  {status?.memory?.withEmbeddings || 0}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="stat">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-ink-lo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="stat__label truncate">Categories</dt>
                <dd className="stat__value text-ink-hi" style={{ fontSize: '24px', marginTop: '4px' }}>
                  {Object.keys(status?.memory?.byCategory || {}).length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="stat">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-ink-lo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="stat__label truncate">Namespaces</dt>
                <dd className="stat__value text-ink-hi" style={{ fontSize: '24px', marginTop: '4px' }}>
                  {Object.keys(status?.memory?.byNamespace || {}).length}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Model Info */}
      <div className="card card--pad">
        <h3 className="text-lg font-display font-medium text-ink-hi mb-4">
          Embedding Model
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-ink-mid">Name</p>
            <p className="text-base font-medium text-ink-hi">
              {status?.model?.name || 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-mid">Status</p>
            <p className="text-base font-medium">
              {status?.model?.available ? (
                <span className="text-success">Available</span>
              ) : (
                <span className="text-warn">Not Available</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-mid">Cached</p>
            <p className="text-base font-medium text-ink-hi">
              {status?.model?.cached ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-mid">Size</p>
            <p className="text-base font-medium text-ink-hi">
              {status?.model?.size || 0} MB
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="card card--pad">
        <h3 className="text-lg font-display font-medium text-ink-hi mb-4">
          Configuration
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-ink-mid">Data Directory</dt>
            <dd className="mt-1 text-sm text-ink-hi font-mono">
              {status?.config?.dataDir}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-ink-mid">Default Namespace</dt>
            <dd className="mt-1 text-sm text-ink-hi">
              {status?.config?.defaultNamespace}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-ink-mid">Recall Limit</dt>
            <dd className="mt-1 text-sm text-ink-hi">
              {status?.config?.recallLimit}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-ink-mid">Secret Detection</dt>
            <dd className="mt-1 text-sm text-ink-hi">
              {status?.config?.secretDetection ? (
                <span className="text-success">Enabled</span>
              ) : (
                <span className="text-danger">Disabled</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
