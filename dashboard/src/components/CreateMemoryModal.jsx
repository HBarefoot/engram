import { useState } from 'react';
import { api } from '../utils/api';

export default function CreateMemoryModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    content: '',
    category: 'fact',
    entity: '',
    confidence: 0.8,
    namespace: 'default',
    tags: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.content.trim()) {
      setError('Content is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = {
        content: formData.content,
        category: formData.category,
        confidence: parseFloat(formData.confidence),
        namespace: formData.namespace
      };

      if (formData.entity.trim()) {
        data.entity = formData.entity.trim();
      }

      if (formData.tags.trim()) {
        data.tags = formData.tags.split(',').map(t => t.trim()).filter(t => t);
      }

      await api.createMemory(data);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Create New Memory
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Content *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows="4"
                placeholder="Enter the memory content..."
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                  <option value="pattern">Pattern</option>
                  <option value="decision">Decision</option>
                  <option value="outcome">Outcome</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Entity (optional)
                </label>
                <input
                  type="text"
                  value={formData.entity}
                  onChange={(e) => setFormData({ ...formData, entity: e.target.value })}
                  placeholder="e.g., docker, deployment"
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Auto-detected if not provided
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confidence
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.confidence}
                  onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  0.0 to 1.0 (default: 0.8)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Namespace
                </label>
                <input
                  type="text"
                  value={formData.namespace}
                  onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                  placeholder="default"
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Project or scope name
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags (optional)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Comma-separated tags
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Memory'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
