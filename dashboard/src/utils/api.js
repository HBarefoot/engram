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
  async getImportSources() {
    const res = await fetch(`${API_BASE}/import/sources`);
    if (!res.ok) throw new Error('Failed to fetch import sources');
    return res.json();
  },

  async scanImportSources(sources) {
    const res = await fetch(`${API_BASE}/import/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources })
    });
    if (!res.ok) throw new Error('Failed to scan import sources');
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
