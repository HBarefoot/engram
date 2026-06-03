import { useState } from 'react';
import { api } from '../utils/api';
import { markOnboardingComplete } from '../utils/onboarding';

const STEPS = ['welcome', 'connect', 'seed', 'done'];

const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "engram": {
      "command": "engram",
      "args": ["start", "--mcp-only"]
    }
  }
}`;

const SUPPORTED_CLIENTS = [
  { name: 'Claude Code', configHint: 'claude mcp add engram -- engram start --mcp-only' },
  { name: 'Claude Desktop', configHint: '~/Library/Application Support/Claude/claude_desktop_config.json' },
  { name: 'Cursor', configHint: '~/.cursor/mcp.json' },
  { name: 'Windsurf', configHint: '~/.windsurf/mcp.json' },
  { name: 'Cline', configHint: 'MCP settings → add new server' }
];

const SEED_EXAMPLES = [
  { label: 'A preference', content: 'I prefer Fastify over Express for Node APIs', category: 'preference' },
  { label: 'A project fact', content: 'Production database is PostgreSQL 15', category: 'fact' },
  { label: 'A workflow', content: 'Deploys go out via GitHub Actions on merge to main', category: 'pattern' }
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [seedContent, setSeedContent] = useState('');
  const [seedCategory, setSeedCategory] = useState('preference');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function finish() {
    markOnboardingComplete();
    onComplete?.();
  }

  function next() {
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep(s => Math.max(s - 1, 0));
  }

  async function saveSeedAndNext() {
    if (!seedContent.trim()) {
      next();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createMemory({
        content: seedContent.trim(),
        category: seedCategory,
        namespace: 'default'
      });
      next();
    } catch (e) {
      setError(e.message || 'Failed to save memory — you can still continue.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">

        {/* Step indicator */}
        <div className="flex gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i <= step ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        {step === 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/engram-logo.png" alt="Engram" className="h-10 w-10 rounded-lg" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome to Engram</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Engram gives your AI agent the memory of a colleague who's worked with you for years —
              without cloud, API keys, or Docker. Everything stays on your machine.
            </p>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Three quick steps to get you set up:
            </p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-primary-500 font-semibold">1.</span>
                Connect your AI agent so it can read and write memories.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 font-semibold">2.</span>
                Seed your first memory (optional — your agent can do this for you later).
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 font-semibold">3.</span>
                Open the dashboard and start using Engram.
              </li>
            </ul>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connect your AI agent</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Add this block to your MCP client config:
            </p>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto mb-4">
              <code>{MCP_CONFIG_SNIPPET}</code>
            </pre>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Supported clients:</p>
            <ul className="space-y-2">
              {SUPPORTED_CLIENTS.map(client => (
                <li key={client.name} className="text-sm text-gray-700 dark:text-gray-300 flex justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-1">
                  <span className="font-medium">{client.name}</span>
                  <code className="text-xs text-gray-500 dark:text-gray-400">{client.configHint}</code>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              The Agents page has a per-platform integration wizard if you'd like a guided setup.
            </p>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Seed a first memory</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Optional. Add one thing you'd want your AI agent to remember about you or your work.
              You can always skip this and let memories accumulate naturally from your conversations.
            </p>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Memory content
            </label>
            <textarea
              value={seedContent}
              onChange={e => setSeedContent(e.target.value)}
              rows={3}
              placeholder="e.g. I prefer Fastify over Express for Node APIs"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
            />

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={seedCategory}
              onChange={e => setSeedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
            >
              <option value="preference">Preference (likes/dislikes)</option>
              <option value="fact">Fact (objective truth)</option>
              <option value="pattern">Pattern (recurring workflow)</option>
              <option value="decision">Decision (choice + rationale)</option>
              <option value="outcome">Outcome (result of an action)</option>
            </select>

            <details className="mb-4">
              <summary className="text-sm text-primary-600 dark:text-primary-400 cursor-pointer hover:underline">
                Need ideas? Show examples
              </summary>
              <div className="mt-2 space-y-2">
                {SEED_EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSeedContent(ex.content);
                      setSeedCategory(ex.category);
                    }}
                    className="block w-full text-left text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-2"
                  >
                    <span className="font-medium text-xs uppercase text-gray-500 dark:text-gray-400 mr-2">
                      {ex.label}
                    </span>
                    {ex.content}
                  </button>
                ))}
              </div>
            </details>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🎉</span>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">You're set</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-3">
              Engram is running on your machine. Once your AI agent is connected, it can
              <code className="text-sm bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded mx-1">engram_remember</code>
              and
              <code className="text-sm bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded mx-1">engram_recall</code>
              memories about you across sessions.
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              From the dashboard you can browse, search, edit, and resolve memory conflicts.
              The Agents page has integration guides if you skipped that step.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-6">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Skip onboarding
          </button>

          <div className="flex gap-2">
            {step > 0 && step < STEPS.length - 1 && (
              <button
                type="button"
                onClick={back}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back
              </button>
            )}

            {step < 2 && (
              <button
                type="button"
                onClick={next}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
              >
                Next
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={saveSeedAndNext}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50"
              >
                {saving ? 'Saving…' : seedContent.trim() ? 'Save & continue' : 'Skip this step'}
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={finish}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
              >
                Open Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
