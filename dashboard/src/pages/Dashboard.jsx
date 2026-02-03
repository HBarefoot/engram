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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">Error: {error}</p>
        <button
          onClick={loadStatus}
          className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome to Engram
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Persistent memory for AI agents - SQLite for agent state
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Memories
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {status?.memory?.total || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    With Embeddings
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {status?.memory?.withEmbeddings || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Categories
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {Object.keys(status?.memory?.byCategory || {}).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Namespaces
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {Object.keys(status?.memory?.byNamespace || {}).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Info */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Embedding Model
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {status?.model?.name || 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <p className="text-base font-medium">
              {status?.model?.available ? (
                <span className="text-green-600 dark:text-green-400">Available</span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400">Not Available</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cached</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {status?.model?.cached ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Size</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {status?.model?.size || 0} MB
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Configuration
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Data Directory</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
              {status?.config?.dataDir}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Default Namespace</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {status?.config?.defaultNamespace}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Recall Limit</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {status?.config?.recallLimit}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Secret Detection</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {status?.config?.secretDetection ? (
                <span className="text-green-600 dark:text-green-400">Enabled</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">Disabled</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
