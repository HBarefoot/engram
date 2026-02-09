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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Smart Import Wizard
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Bootstrap memories from your existing tools
        </span>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center space-x-2">
        {STEPS.map((name, i) => (
          <div key={name} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              i < step ? 'bg-green-500 text-white' :
              i === step ? 'bg-primary-600 text-white' :
              'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {i < step ? '\u2713' : i + 1}
            </div>
            <span className={`ml-2 text-sm ${
              i === step ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {name}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-3 h-px w-8 ${
                i < step ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Step 0: Select Sources */}
      {step === 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Select Import Sources
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Sources with a green badge were auto-detected on your system.
          </p>

          {/* Extra paths management */}
          <div className="mb-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Additional scan directories</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPath()}
                placeholder="e.g. ~/repos/my-project"
                className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
              />
              <button
                onClick={addPath}
                disabled={!newPath.trim()}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {extraPaths.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {extraPaths.map(p => (
                  <span key={p} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded">
                    {p}
                    <button onClick={() => removePath(p)} className="text-gray-400 hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={selectAll} className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Select all found
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button onClick={deselectAll} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
              Deselect all
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Detecting sources...</div>
          ) : (
            <div className="grid gap-3">
              {sources.map(source => (
                <label
                  key={source.id}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSources.includes(source.id)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${!source.detected?.found ? 'opacity-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                    disabled={!source.detected?.found}
                    className="mr-3 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{source.label}</span>
                      {source.detected?.found ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Found
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          Not found
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {source.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{source.description}</p>
                    {source.detected?.paths && source.detected.paths.length > 1 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
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
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Scan Selected Sources ({selectedSources.length})
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Scanning */}
      {step === 1 && loading && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Scanning sources...</p>
          <p className="text-sm text-gray-400 mt-2">Extracting memories from {selectedSources.length} source(s)</p>
        </div>
      )}

      {/* Step 2: Preview & Edit */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Preview Extracted Memories ({memories.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={selectAllMemories} className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
                Select all
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button onClick={deselectAllMemories} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
                Deselect all
              </button>
            </div>
          </div>

          {scanResult?.warnings?.length > 0 && (
            <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">Warnings:</p>
              {scanResult.warnings.map((w, i) => (
                <p key={i} className="text-sm text-yellow-600 dark:text-yellow-500">{w}</p>
              ))}
            </div>
          )}

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {memories.map((memory, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 transition-colors ${
                  memory.selected
                    ? 'border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-800'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={memory.selected}
                    onChange={() => toggleMemory(index)}
                    className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={memory.content}
                      onChange={(e) => updateMemory(index, 'content', e.target.value)}
                      rows={2}
                      className="w-full text-sm border-0 bg-transparent text-gray-900 dark:text-white resize-none focus:ring-0 p-0"
                    />
                    <div className="flex items-center gap-3 mt-2">
                      <select
                        value={memory.category}
                        onChange={(e) => updateMemory(index, 'category', e.target.value)}
                        className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">Confidence:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={memory.confidence}
                          onChange={(e) => updateMemory(index, 'confidence', parseFloat(e.target.value))}
                          className="w-20 h-1 accent-primary-500"
                        />
                        <span className="text-xs text-gray-500 w-8">{memory.confidence.toFixed(2)}</span>
                      </div>
                      <span className="text-xs text-gray-400">{memory.source}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMemory(index)}
                    className="text-gray-400 hover:text-red-500 text-sm p-1"
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
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Back
            </button>
            <button
              onClick={handleCommit}
              disabled={selectedCount === 0 || loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Commit {selectedCount} Memories
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Committing */}
      {step === 3 && loading && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Committing memories...</p>
          <p className="text-sm text-gray-400 mt-2">Generating embeddings and deduplicating</p>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && commitResult && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Import Complete
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg mx-auto mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{commitResult.created}</div>
              <div className="text-xs text-green-700 dark:text-green-500">Created</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{commitResult.merged}</div>
              <div className="text-xs text-blue-700 dark:text-blue-500">Merged</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{commitResult.duplicates}</div>
              <div className="text-xs text-yellow-700 dark:text-yellow-500">Duplicates</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{commitResult.rejected}</div>
              <div className="text-xs text-red-700 dark:text-red-500">Rejected</div>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
