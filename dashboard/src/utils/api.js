const API_BASE = '/api';

export const api = {
  async getStatus() {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  },

  async getMemories(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/memories${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch memories');
    return res.json();
  },

  async getMemory(id) {
    const res = await fetch(`${API_BASE}/memories/${id}`);
    if (!res.ok) throw new Error('Failed to fetch memory');
    return res.json();
  },

  async createMemory(data) {
    const res = await fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create memory');
    return res.json();
  },

  async searchMemories(query, options = {}) {
    const res = await fetch(`${API_BASE}/memories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options })
    });
    if (!res.ok) throw new Error('Failed to search memories');
    return res.json();
  },

  async deleteMemory(id) {
    const res = await fetch(`${API_BASE}/memories/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete memory');
    return res.json();
  },

  async consolidate(options = {}) {
    const res = await fetch(`${API_BASE}/consolidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!res.ok) throw new Error('Failed to consolidate');
    return res.json();
  },

  async getConflicts() {
    const res = await fetch(`${API_BASE}/conflicts`);
    if (!res.ok) throw new Error('Failed to fetch conflicts');
    return res.json();
  },

  // Contradictions endpoints
  async getContradictions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/contradictions${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch contradictions');
    return res.json();
  },

  async resolveContradiction(id, action) {
    const res = await fetch(`${API_BASE}/contradictions/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (!res.ok) throw new Error('Failed to resolve contradiction');
    return res.json();
  },

  async getContradictionCount() {
    const res = await fetch(`${API_BASE}/contradictions/count`);
    if (!res.ok) throw new Error('Failed to fetch contradiction count');
    return res.json();
  },

  async getHealth() {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('Failed to fetch health');
    return res.json();
  },

  async getInstallationInfo() {
    const res = await fetch(`${API_BASE}/installation-info`);
    if (!res.ok) throw new Error('Failed to fetch installation info');
    return res.json();
  },

  // Import wizard endpoints
  async getImportSources(paths) {
    const params = new URLSearchParams();
    if (paths && paths.length > 0) params.set('paths', paths.join(','));
    const query = params.toString();
    const res = await fetch(`${API_BASE}/import/sources${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch import sources');
    return res.json();
  },

  async scanImportSources(sources, paths) {
    const body = { sources };
    if (paths && paths.length > 0) body.paths = paths;
    const res = await fetch(`${API_BASE}/import/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Failed to scan import sources');
    return res.json();
  },

  // Analytics endpoints
  async getAnalyticsOverview() {
    const res = await fetch(`${API_BASE}/analytics/overview`);
    if (!res.ok) throw new Error('Failed to fetch analytics overview');
    return res.json();
  },

  async getStaleMemories(days = 30, limit = 50) {
    const res = await fetch(`${API_BASE}/analytics/stale?days=${days}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch stale memories');
    return res.json();
  },

  async getNeverRecalled(limit = 50) {
    const res = await fetch(`${API_BASE}/analytics/never-recalled?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch never-recalled memories');
    return res.json();
  },

  async getDuplicates() {
    const res = await fetch(`${API_BASE}/analytics/duplicates`);
    if (!res.ok) throw new Error('Failed to fetch duplicates');
    return res.json();
  },

  async getTrends(days = 30) {
    const res = await fetch(`${API_BASE}/analytics/trends?days=${days}`);
    if (!res.ok) throw new Error('Failed to fetch trends');
    return res.json();
  },

  async bulkDeleteMemories(ids) {
    const res = await fetch(`${API_BASE}/memories/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!res.ok) throw new Error('Failed to bulk delete memories');
    return res.json();
  },

  async commitImport(memories, namespace) {
    const res = await fetch(`${API_BASE}/import/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memories, namespace })
    });
    if (!res.ok) throw new Error('Failed to commit import');
    return res.json();
  }
};
