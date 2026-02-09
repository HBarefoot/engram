import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api, ImportSource, ImportMemory } from "../lib/api";

const STEPS = ["Select Sources", "Scan", "Preview & Edit", "Commit", "Done"];
const CATEGORIES = ["preference", "fact", "pattern", "decision", "outcome"];

export default function Import() {
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<{ warnings: string[] } | null>(null);
  const [memories, setMemories] = useState<(ImportMemory & { selected: boolean })[]>([]);
  const [commitResult, setCommitResult] = useState<{
    created: number;
    merged: number;
    duplicates: number;
    rejected: number;
    duration: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraPaths, setExtraPaths] = useState<string[]>([]);
  const [newPath, setNewPath] = useState("");

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources(paths?: string[]) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getImportSources(paths ?? extraPaths);
      setSources(data.sources || []);
      const found = (data.sources || []).filter((s) => s.detected?.found).map((s) => s.id);
      setSelectedSources(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }

  function addPath() {
    const trimmed = newPath.trim();
    if (trimmed && !extraPaths.includes(trimmed)) {
      const updated = [...extraPaths, trimmed];
      setExtraPaths(updated);
      setNewPath("");
      loadSources(updated);
    }
  }

  function removePath(p: string) {
    const updated = extraPaths.filter((ep) => ep !== p);
    setExtraPaths(updated);
    loadSources(updated);
  }

  function toggleSource(id: string) {
    setSelectedSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleScan() {
    setStep(1);
    setLoading(true);
    setError(null);
    try {
      const data = await api.scanImportSources(selectedSources, extraPaths);
      setScanResult({ warnings: data.warnings });
      setMemories((data.memories || []).map((m) => ({ ...m, selected: true })));
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    const toCommit = memories.filter((m) => m.selected);
    if (toCommit.length === 0) return;
    setStep(3);
    setLoading(true);
    setError(null);
    try {
      const data = await api.commitImport(toCommit);
      setCommitResult(data.results);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  function updateMemory(index: number, field: string, value: string | number | boolean) {
    setMemories((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  const selectedCount = memories.filter((m) => m.selected).length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Smart Import Wizard</h2>
        <span className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          Bootstrap memories from your existing tools
        </span>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((name, i) => (
          <div key={name} className="flex items-center">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                i < step
                  ? "bg-green-500 text-white"
                  : i === step
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              }`}
            >
              {i < step ? "\u2713" : i + 1}
            </div>
            <span
              className={`ml-1.5 text-xs ${
                i === step ? "font-medium" : ""
              }`}
              style={{ color: i === step ? undefined : "rgba(var(--text-secondary), 1)" }}
            >
              {name}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-px w-6 ${i < step ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-[10px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Step 0: Select Sources */}
      {step === 0 && (
        <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
          <h3 className="text-base font-semibold mb-1">Select Import Sources</h3>
          <p className="text-sm mb-4" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            Sources with a green badge were auto-detected on your system.
          </p>

          {/* Extra paths management */}
          <div className="mb-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg" style={{ background: "rgba(var(--bg-secondary), 0.5)" }}>
            <p className="text-xs font-medium mb-2">Additional scan directories</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPath()}
                placeholder="e.g. ~/repos/my-project"
                className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1.5 bg-white dark:bg-gray-800"
                style={{ color: "rgba(var(--text-primary), 1)" }}
              />
              <button
                onClick={addPath}
                disabled={!newPath.trim()}
                className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
            {extraPaths.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {extraPaths.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded">
                    {p}
                    <button onClick={() => removePath(p)} className="text-gray-400 hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedSources(sources.filter((s) => s.detected?.found).map((s) => s.id))}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Select all found
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button onClick={() => setSelectedSources([])} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">
              Deselect all
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>Detecting sources...</div>
          ) : (
            <div className="grid gap-2">
              {sources.map((source) => (
                <label
                  key={source.id}
                  className={`flex items-center p-3 border rounded-[10px] cursor-pointer transition-colors ${
                    selectedSources.includes(source.id)
                      ? "border-blue-400 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-700"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  } ${!source.detected?.found ? "opacity-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                    disabled={!source.detected?.found}
                    className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{source.label}</span>
                      {source.detected?.found ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Found</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">Not found</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(var(--text-secondary), 1)" }}>{source.description}</p>
                    {source.detected?.paths && source.detected.paths.length > 1 && (
                      <p className="text-xs mt-0.5" style={{ color: "rgba(var(--text-secondary), 0.7)" }}>
                        Found in: {source.detected.paths.join(", ")}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              onClick={handleScan}
              disabled={selectedSources.length === 0 || loading}
              className="px-4 py-2 text-sm font-medium text-white rounded-[10px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Scan Selected ({selectedSources.length})
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Scanning */}
      {step === 1 && loading && (
        <div className="glass rounded-[10px] p-12 border border-gray-200/50 dark:border-gray-700/50 text-center">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm">Scanning sources...</p>
          <p className="text-xs mt-1" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            Extracting memories from {selectedSources.length} source(s)
          </p>
        </div>
      )}

      {/* Step 2: Preview & Edit */}
      {step === 2 && (
        <div className="glass rounded-[10px] p-6 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Preview ({memories.length})</h3>
            <div className="flex gap-2">
              <button onClick={() => setMemories((p) => p.map((m) => ({ ...m, selected: true })))} className="text-xs text-blue-600 dark:text-blue-400">
                Select all
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button onClick={() => setMemories((p) => p.map((m) => ({ ...m, selected: false })))} className="text-xs text-gray-500 dark:text-gray-400">
                Deselect all
              </button>
            </div>
          </div>

          {scanResult?.warnings && scanResult.warnings.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              {scanResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{w}</p>
              ))}
            </div>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {memories.map((memory, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 transition-colors ${
                  memory.selected
                    ? "border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-60"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={memory.selected}
                    onChange={() => updateMemory(index, "selected", !memory.selected)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={memory.content}
                      onChange={(e) => updateMemory(index, "content", e.target.value)}
                      rows={2}
                      className="w-full text-sm border-0 bg-transparent resize-none focus:ring-0 p-0"
                      style={{ color: "rgba(var(--text-primary), 1)" }}
                    />
                    <div className="flex items-center gap-3 mt-1">
                      <select
                        value={memory.category}
                        onChange={(e) => updateMemory(index, "category", e.target.value)}
                        className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-transparent"
                        style={{ color: "rgba(var(--text-primary), 1)" }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>Confidence:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={memory.confidence}
                          onChange={(e) => updateMemory(index, "confidence", parseFloat(e.target.value))}
                          className="w-16 h-1 accent-blue-500"
                        />
                        <span className="text-xs w-7" style={{ color: "rgba(var(--text-secondary), 1)" }}>{memory.confidence.toFixed(2)}</span>
                      </div>
                      <span className="text-xs" style={{ color: "rgba(var(--text-secondary), 1)" }}>{memory.source}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMemories((p) => p.filter((_, i) => i !== index))}
                    className="text-gray-400 hover:text-red-500 text-sm p-1"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button onClick={() => setStep(0)} className="text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
              Back
            </button>
            <button
              onClick={handleCommit}
              disabled={selectedCount === 0 || loading}
              className="px-4 py-2 text-sm font-medium text-white rounded-[10px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Commit {selectedCount} Memories
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Committing */}
      {step === 3 && loading && (
        <div className="glass rounded-[10px] p-12 border border-gray-200/50 dark:border-gray-700/50 text-center">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm">Committing memories...</p>
          <p className="text-xs mt-1" style={{ color: "rgba(var(--text-secondary), 1)" }}>Generating embeddings and deduplicating</p>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && commitResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-[10px] p-8 border border-gray-200/50 dark:border-gray-700/50 text-center"
        >
          <div className="text-4xl mb-4 text-green-500">{"\u2713"}</div>
          <h3 className="text-lg font-semibold mb-4">Import Complete</h3>

          <div className="grid grid-cols-4 gap-3 max-w-md mx-auto mb-6">
            {[
              { label: "Created", value: commitResult.created, bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-600 dark:text-green-400", sub: "text-green-700 dark:text-green-500" },
              { label: "Merged", value: commitResult.merged, bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", sub: "text-blue-700 dark:text-blue-500" },
              { label: "Duplicates", value: commitResult.duplicates, bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-600 dark:text-yellow-400", sub: "text-yellow-700 dark:text-yellow-500" },
              { label: "Rejected", value: commitResult.rejected, bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-600 dark:text-red-400", sub: "text-red-700 dark:text-red-500" },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.bg} rounded-lg p-3`}>
                <div className={`text-xl font-bold ${stat.text}`}>{stat.value}</div>
                <div className={`text-xs ${stat.sub}`}>{stat.label}</div>
              </div>
            ))}
          </div>

          <p className="text-xs mb-5" style={{ color: "rgba(var(--text-secondary), 1)" }}>
            Completed in {commitResult.duration}ms
          </p>

          <button
            onClick={() => {
              setStep(0);
              setScanResult(null);
              setMemories([]);
              setCommitResult(null);
              setExtraPaths([]);
              setNewPath("");
            }}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Import More
          </button>
        </motion.div>
      )}
    </div>
  );
}
