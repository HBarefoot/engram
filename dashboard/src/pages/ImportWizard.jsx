import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const STEPS = ['Select Sources', 'Scan', 'Preview & Edit', 'Commit', 'Done'];
const CATEGORIES = ['preference', 'fact', 'pattern', 'decision', 'outcome'];

export default function ImportWizard() {
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [memories, setMemories] = useState([]);
  const [commitResult, setCommitResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extraPaths, setExtraPaths] = useState([]);
  const [newPath, setNewPath] = useState('');

  // Load sources on mount
  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources(paths) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getImportSources(paths || extraPaths);
      setSources(data.sources || []);
      // Auto-select found sources
      const found = (data.sources || []).filter(s => s.detected?.found).map(s => s.id);
      setSelectedSources(found);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function addPath() {
    const trimmed = newPath.trim();
    if (trimmed && !extraPaths.includes(trimmed)) {
      const updated = [...extraPaths, trimmed];
      setExtraPaths(updated);
      setNewPath('');
      loadSources(updated);
    }
  }

  function removePath(p) {
    const updated = extraPaths.filter(ep => ep !== p);
    setExtraPaths(updated);
    loadSources(updated);
  }

  function toggleSource(id) {
    setSelectedSources(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  function selectAll() {
    const found = sources.filter(s => s.detected?.found).map(s => s.id);
    setSelectedSources(found);
  }

  function deselectAll() {
    setSelectedSources([]);
  }

  async function handleScan() {
    setStep(1);
    setLoading(true);
    setError(null);
    try {
      const data = await api.scanImportSources(selectedSources, extraPaths);
      setScanResult(data);
      // Initialize editable memories with selection state
      setMemories((data.memories || []).map(m => ({ ...m, selected: true })));
      setStep(2);
    } catch (err) {
      setError(err.message);
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    const toCommit = memories.filter(m => m.selected);
    if (toCommit.length === 0) return;

    setStep(3);
    setLoading(true);
    setError(null);
    try {
      const data = await api.commitImport(toCommit);
      setCommitResult(data.results);
      setStep(4);
    } catch (err) {
      setError(err.message);
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  function updateMemory(index, field, value) {
    setMemories(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function toggleMemory(index) {
    updateMemory(index, 'selected', !memories[index].selected);
  }

  function selectAllMemories() {
    setMemories(prev => prev.map(m => ({ ...m, selected: true })));
  }

  function deselectAllMemories() {
    setMemories(prev => prev.map(m => ({ ...m, selected: false })));
  }

  function deleteMemory(index) {
    setMemories(prev => prev.filter((_, i) => i !== index));
  }

  const selectedCount = memories.filter(m => m.selected).length;

  return (
    <div className="space-y-6">
      <div className="page-head flex items-center justify-between" style={{ marginBottom: 0 }}>
        <h2>Smart Import Wizard</h2>
        <span className="text-sm" style={{ color: 'var(--text-mid)' }}>
          Bootstrap memories from your existing tools
        </span>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center space-x-2">
        {STEPS.map((name, i) => (
          <div key={name} className="flex items-center">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium"
              style={
                i < step ? { background: 'var(--success)', color: 'var(--text-on-accent)' } :
                i === step ? { background: 'var(--accent)', color: 'var(--text-on-accent)' } :
                { background: 'var(--surface-3)', color: 'var(--text-mid)' }
              }
            >
              {i < step ? '\u2713' : i + 1}
            </div>
            <span
              className="ml-2 text-sm"
              style={i === step ? { color: 'var(--text-hi)', fontWeight: 500 } : { color: 'var(--text-mid)' }}
            >
              {name}
            </span>
            {i < STEPS.length - 1 && (
              <div className="mx-3 h-px w-8" style={{ background: i < step ? 'var(--success)' : 'var(--border-strong)' }} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="card card--pad" style={{ borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)', background: 'color-mix(in oklab, var(--danger) 10%, var(--surface-1))' }}>
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {/* Step 0: Select Sources */}
      {step === 0 && (
        <div className="card card--pad">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-hi)' }}>
            Select Import Sources
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-mid)' }}>
            Sources with a green badge were auto-detected on your system.
          </p>

          {/* Extra paths management */}
          <div className="mb-4 p-3 rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-hi)' }}>Additional scan directories</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPath()}
                placeholder="e.g. ~/repos/my-project"
                className="field flex-1"
              />
              <button
                onClick={addPath}
                disabled={!newPath.trim()}
                className="btn disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {extraPaths.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {extraPaths.map(p => (
                  <span key={p} className="badge badge--neutral mono">
                    {p}
                    <button onClick={() => removePath(p)} style={{ color: 'var(--text-lo)' }} className="hover:opacity-70">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={selectAll} className="text-sm" style={{ color: 'var(--accent)' }}>
              Select all found
            </button>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <button onClick={deselectAll} className="text-sm" style={{ color: 'var(--text-mid)' }}>
              Deselect all
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8" style={{ color: 'var(--text-mid)' }}>Detecting sources...</div>
          ) : (
            <div className="grid gap-3">
              {sources.map(source => (
                <label
                  key={source.id}
                  className="flex items-center p-4 rounded-lg cursor-pointer transition-colors card--inset"
                  style={{
                    border: '1px solid',
                    borderColor: selectedSources.includes(source.id) ? 'var(--accent-line)' : 'var(--border)',
                    boxShadow: selectedSources.includes(source.id) ? 'var(--glow)' : 'none',
                    opacity: !source.detected?.found ? 0.5 : 1
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                    disabled={!source.detected?.found}
                    className="mr-3"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: 'var(--text-hi)' }}>{source.label}</span>
                      {source.detected?.found ? (
                        <span className="badge badge--pattern">
                          Found
                        </span>
                      ) : (
                        <span className="badge badge--neutral">
                          Not found
                        </span>
                      )}
                      <span className="badge badge--fact">
                        {source.category}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-mid)' }}>{source.description}</p>
                    {source.detected?.paths && source.detected.paths.length > 1 && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-lo)' }}>
                        Found in: {source.detected.paths.join(', ')}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleScan}
              disabled={selectedSources.length === 0 || loading}
              className="btn btn--primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Scan Selected Sources ({selectedSources.length})
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Scanning */}
      {step === 1 && loading && (
        <div className="card card--pad text-center" style={{ padding: '48px' }}>
          <div className="spinner mx-auto mb-4" style={{ width: '32px', height: '32px' }} />
          <p style={{ color: 'var(--text-mid)' }}>Scanning sources...</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-lo)' }}>Extracting memories from {selectedSources.length} source(s)</p>
        </div>
      )}

      {/* Step 2: Preview & Edit */}
      {step === 2 && (
        <div className="card card--pad">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-hi)' }}>
              Preview Extracted Memories ({memories.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={selectAllMemories} className="text-sm" style={{ color: 'var(--accent)' }}>
                Select all
              </button>
              <span style={{ color: 'var(--border-strong)' }}>|</span>
              <button onClick={deselectAllMemories} className="text-sm" style={{ color: 'var(--text-mid)' }}>
                Deselect all
              </button>
            </div>
          </div>

          {scanResult?.warnings?.length > 0 && (
            <div className="mb-4 rounded-lg p-3" style={{ border: '1px solid color-mix(in oklab, var(--warn) 35%, transparent)', background: 'color-mix(in oklab, var(--warn) 10%, var(--surface-1))' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--warn)' }}>Warnings:</p>
              {scanResult.warnings.map((w, i) => (
                <p key={i} className="text-sm" style={{ color: 'var(--text-mid)' }}>{w}</p>
              ))}
            </div>
          )}

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {memories.map((memory, index) => (
              <div
                key={index}
                className="rounded-lg p-3 transition-colors"
                style={{
                  border: '1px solid',
                  borderColor: memory.selected ? 'var(--accent-line)' : 'var(--border)',
                  background: 'var(--surface-2)',
                  opacity: memory.selected ? 1 : 0.6
                }}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={memory.selected}
                    onChange={() => toggleMemory(index)}
                    className="mt-1"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={memory.content}
                      onChange={(e) => updateMemory(index, 'content', e.target.value)}
                      rows={2}
                      className="w-full text-sm border-0 bg-transparent resize-none focus:ring-0 p-0"
                      style={{ color: 'var(--text-hi)' }}
                    />
                    <div className="flex items-center gap-3 mt-2">
                      <select
                        value={memory.category}
                        onChange={(e) => updateMemory(index, 'category', e.target.value)}
                        className="text-xs rounded px-2 py-1"
                        style={{ border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text-mid)' }}
                      >
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: 'var(--text-lo)' }}>Confidence:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={memory.confidence}
                          onChange={(e) => updateMemory(index, 'confidence', parseFloat(e.target.value))}
                          className="w-20 h-1"
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span className="text-xs w-8" style={{ color: 'var(--text-mid)' }}>{memory.confidence.toFixed(2)}</span>
                      </div>
                      <span className="text-xs mono" style={{ color: 'var(--text-lo)' }}>{memory.source}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMemory(index)}
                    className="text-sm p-1 hover:opacity-70"
                    style={{ color: 'var(--text-lo)' }}
                    title="Remove"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep(0)}
              className="btn btn--ghost"
            >
              Back
            </button>
            <button
              onClick={handleCommit}
              disabled={selectedCount === 0 || loading}
              className="btn btn--primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Commit {selectedCount} Memories
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Committing */}
      {step === 3 && loading && (
        <div className="card card--pad text-center" style={{ padding: '48px' }}>
          <div className="spinner mx-auto mb-4" style={{ width: '32px', height: '32px' }} />
          <p style={{ color: 'var(--text-mid)' }}>Committing memories...</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-lo)' }}>Generating embeddings and deduplicating</p>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && commitResult && (
        <div className="card card--pad text-center">
          <div className="text-4xl mb-4" style={{ color: 'var(--success)' }}>&#10003;</div>
          <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-hi)' }}>
            Import Complete
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg mx-auto mb-6">
            <div className="rounded-lg p-3" style={{ background: 'color-mix(in oklab, var(--success) 12%, var(--surface-1))' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{commitResult.created}</div>
              <div className="text-xs" style={{ color: 'var(--success)' }}>Created</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'color-mix(in oklab, var(--info) 12%, var(--surface-1))' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--info)' }}>{commitResult.merged}</div>
              <div className="text-xs" style={{ color: 'var(--info)' }}>Merged</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'color-mix(in oklab, var(--warn) 12%, var(--surface-1))' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--warn)' }}>{commitResult.duplicates}</div>
              <div className="text-xs" style={{ color: 'var(--warn)' }}>Duplicates</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'color-mix(in oklab, var(--danger) 12%, var(--surface-1))' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--danger)' }}>{commitResult.rejected}</div>
              <div className="text-xs" style={{ color: 'var(--danger)' }}>Rejected</div>
            </div>
          </div>

          <p className="text-sm mb-6" style={{ color: 'var(--text-mid)' }}>
            Completed in {commitResult.duration}ms
          </p>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setStep(0);
                setScanResult(null);
                setMemories([]);
                setCommitResult(null);
                setExtraPaths([]);
                setNewPath('');
              }}
              className="btn btn--ghost"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
