import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import IntegrationWizard from '../components/IntegrationWizard';

export default function Agents() {
  const [status, setStatus] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [setupTab, setSetupTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [statusData, memoriesData] = await Promise.all([
        api.getStatus(),
        api.getMemories({ limit: 1000 }) // Get all to analyze
      ]);
      setStatus(statusData);
      setMemories(memoriesData.memories || []);
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
      </div>
    );
  }

  // Analyze memories by source
  const bySource = memories.reduce((acc, m) => {
    const source = m.source || 'unknown';
    if (!acc[source]) {
      acc[source] = {
        count: 0,
        namespaces: new Set(),
        categories: {},
        lastActivity: 0
      };
    }
    acc[source].count++;
    acc[source].namespaces.add(m.namespace);
    acc[source].categories[m.category] = (acc[source].categories[m.category] || 0) + 1;

    const activity = m.lastAccessed || m.createdAt;
    if (activity > acc[source].lastActivity) {
      acc[source].lastActivity = activity;
    }
    return acc;
  }, {});

  // Analyze memories by namespace (agent instances)
  const byNamespace = memories.reduce((acc, m) => {
    const ns = m.namespace || 'default';
    if (!acc[ns]) {
      acc[ns] = {
        count: 0,
        sources: new Set(),
        categories: {},
        withEmbeddings: 0,
        totalAccess: 0,
        lastActivity: 0
      };
    }
    acc[ns].count++;
    acc[ns].sources.add(m.source || 'unknown');
    acc[ns].categories[m.category] = (acc[ns].categories[m.category] || 0) + 1;
    acc[ns].totalAccess += m.accessCount || 0;

    const activity = m.lastAccessed || m.createdAt;
    if (activity > acc[ns].lastActivity) {
      acc[ns].lastActivity = activity;
    }
    return acc;
  }, {});

  const getSourceIcon = (source) => {
    const icons = {
      cli: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
        </svg>
      ),
      mcp: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2zM9 9h6v6H9V9z" />
        </svg>
      ),
      api: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      unknown: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    };
    return icons[source] || icons.unknown;
  };

  const getSourceColor = (source) => {
    const colors = {
      cli: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      mcp: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      api: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    return colors[source] || colors.unknown;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Agent Integrations
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of agents and interfaces using Engram for persistent memory
        </p>
      </div>

      {/* Integration Methods */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Active Integration Sources
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(bySource).map(([source, data]) => (
            <div
              key={source}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${getSourceColor(source)}`}>
                  {getSourceIcon(source)}
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.count}
                </span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white capitalize mb-2">
                {source}
              </h4>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>Namespaces: {data.namespaces.size}</p>
                <p>Categories: {Object.keys(data.categories).length}</p>
                <p>Last active: {formatDate(data.lastActivity)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Namespaces (Agent Instances) */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Agent Namespaces
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Each namespace represents a separate agent instance or context. Use namespaces to keep memories isolated between different agents, projects, or environments.
        </p>
        <div className="space-y-4">
          {Object.entries(byNamespace).map(([namespace, data]) => {
            const avgAccess = data.totalAccess / data.count;
            return (
              <div
                key={namespace}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                    {namespace}
                  </h4>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {data.count} memories
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Sources</p>
                    <div className="flex gap-1 mt-1">
                      {Array.from(data.sources).map((source, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSourceColor(source)}`}
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Categories</p>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {Object.entries(data.categories)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 2)
                        .map(([cat, count]) => `${cat} (${count})`)
                        .join(', ')}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Avg Access</p>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {avgAccess.toFixed(1)}x
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Last Active</p>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {formatDate(data.lastActivity)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Integration Hub - Tabbed Interface */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setSetupTab('overview')}
              className={`px-6 py-3 text-sm font-medium ${
                setupTab === 'overview'
                  ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Integration Overview
            </button>
            <button
              onClick={() => setSetupTab('setup')}
              className={`px-6 py-3 text-sm font-medium ${
                setupTab === 'setup'
                  ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Quick Setup
            </button>
          </nav>
        </div>

        <div className="p-6">
          {setupTab === 'overview' ? (
            // Integration Overview content
            <div className="space-y-4 text-sm text-blue-800 dark:text-blue-300">
              <div>
                <h4 className="font-semibold mb-1 text-gray-900 dark:text-white">1. MCP Integration (Claude Desktop/Code)</h4>
                <p className="text-gray-700 dark:text-gray-400">
                  Add Engram to your Claude Desktop configuration. Claude will automatically use engram_remember and engram_recall tools.
                </p>
                <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs text-gray-800 dark:text-gray-200">
                  See docs/mcp-setup.md for configuration
                </code>
              </div>

              <div>
                <h4 className="font-semibold mb-1 text-gray-900 dark:text-white">2. REST API Integration</h4>
                <p className="text-gray-700 dark:text-gray-400">
                  Use the REST API from any programming language. Create memories with custom namespaces for each agent.
                </p>
                <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs text-gray-800 dark:text-gray-200">
                  POST http://localhost:3838/api/memories {"{"}"namespace": "my-agent"{"}"}
                </code>
              </div>

              <div>
                <h4 className="font-semibold mb-1 text-gray-900 dark:text-white">3. CLI Integration</h4>
                <p className="text-gray-700 dark:text-gray-400">
                  Call Engram CLI from your agent's code or scripts. Perfect for shell-based agents.
                </p>
                <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs text-gray-800 dark:text-gray-200">
                  node bin/engram.js remember "..." --namespace my-agent
                </code>
              </div>
            </div>
          ) : (
            // Quick Setup section
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🚀</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Set Up Engram in Minutes
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
                  Get copy-paste ready configurations for Claude Desktop, Claude Code, and other AI platforms.
                  No manual path finding required!
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium inline-flex items-center space-x-2"
                >
                  <span>Launch Setup Wizard</span>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>

              {/* Feature highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-3xl mb-2">🎯</div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Auto-Detection</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Installation path detected automatically
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">📋</div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Copy & Paste</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ready-to-use configurations for all platforms
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">✅</div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Validated</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Real-time validation and success indicators
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <IntegrationWizard onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
