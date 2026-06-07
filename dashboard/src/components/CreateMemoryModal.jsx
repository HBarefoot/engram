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
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__head">
          <h3 className="text-lg font-medium text-ink-hi">
            Create New Memory
          </h3>
          <button
            onClick={onClose}
            className="btn btn--icon btn--ghost"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {error && (
            <div className="mb-4 card card--pad" style={{ borderColor: 'var(--danger)', padding: '12px 14px' }}>
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">
                Content *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows="4"
                placeholder="Enter the memory content..."
                className="field"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="field"
                >
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                  <option value="pattern">Pattern</option>
                  <option value="decision">Decision</option>
                  <option value="outcome">Outcome</option>
                </select>
              </div>

              <div>
                <label className="field-label">
                  Entity (optional)
                </label>
                <input
                  type="text"
                  value={formData.entity}
                  onChange={(e) => setFormData({ ...formData, entity: e.target.value })}
                  placeholder="e.g., docker, deployment"
                  className="field"
                />
                <p className="mt-1 text-xs text-ink-mid">
                  Auto-detected if not provided
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">
                  Confidence
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.confidence}
                  onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
                  className="field"
                />
                <p className="mt-1 text-xs text-ink-mid">
                  0.0 to 1.0 (default: 0.8)
                </p>
              </div>

              <div>
                <label className="field-label">
                  Namespace
                </label>
                <input
                  type="text"
                  value={formData.namespace}
                  onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                  placeholder="default"
                  className="field"
                />
                <p className="mt-1 text-xs text-ink-mid">
                  Project or scope name
                </p>
              </div>
            </div>

            <div>
              <label className="field-label">
                Tags (optional)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
                className="field"
              />
              <p className="mt-1 text-xs text-ink-mid">
                Comma-separated tags
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn--ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn--primary disabled:opacity-50 disabled:cursor-not-allowed"
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
