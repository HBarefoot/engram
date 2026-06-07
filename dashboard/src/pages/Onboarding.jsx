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
    <div className="flex items-center justify-center p-4" style={{ background: 'var(--bg-sunken)', minHeight: '100vh' }}>
      <div className="card card--pad max-w-2xl w-full" style={{ borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-3)' }}>

        {/* Step indicator */}
        <div className="flex gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{ background: i <= step ? 'var(--accent)' : 'var(--surface-3)' }}
            />
          ))}
        </div>

        {/* Step content */}
        {step === 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/engram-logo.png" alt="Engram" className="h-10 w-10 rounded-xl" />
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-hi)' }}>Welcome to Engram</h1>
            </div>
            <p className="mb-4" style={{ color: 'var(--text-mid)' }}>
              Engram gives your AI agent the memory of a colleague who's worked with you for years —
              without cloud, API keys, or Docker. Everything stays on your machine.
            </p>
            <p className="mb-4" style={{ color: 'var(--text-mid)' }}>
              Three quick steps to get you set up:
            </p>
            <ul className="space-y-2" style={{ color: 'var(--text-mid)' }}>
              <li className="flex items-start gap-2">
                <span className="font-semibold" style={{ color: 'var(--accent)' }}>1.</span>
                Connect your AI agent so it can read and write memories.
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold" style={{ color: 'var(--accent)' }}>2.</span>
                Seed your first memory (optional — your agent can do this for you later).
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold" style={{ color: 'var(--accent)' }}>3.</span>
                Open the dashboard and start using Engram.
              </li>
            </ul>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-hi)' }}>Connect your AI agent</h1>
            <p className="mb-4" style={{ color: 'var(--text-mid)' }}>
              Add this block to your MCP client config:
            </p>
            <pre className="rounded-lg p-4 text-sm overflow-x-auto mb-4 mono" style={{ background: 'var(--surface-2)', color: 'var(--text-hi)', border: '1px solid var(--border)' }}>
              <code>{MCP_CONFIG_SNIPPET}</code>
            </pre>
            <p className="text-sm mb-3" style={{ color: 'var(--text-mid)' }}>Supported clients:</p>
            <ul className="space-y-2">
              {SUPPORTED_CLIENTS.map(client => (
                <li key={client.name} className="text-sm flex justify-between gap-3 pb-1" style={{ color: 'var(--text-mid)', borderBottom: '1px solid var(--border-soft)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-hi)' }}>{client.name}</span>
                  <code className="text-xs mono" style={{ color: 'var(--text-lo)' }}>{client.configHint}</code>
                </li>
              ))}
            </ul>
            <p className="text-xs mt-4" style={{ color: 'var(--text-lo)' }}>
              The Agents page has a per-platform integration wizard if you'd like a guided setup.
            </p>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-hi)' }}>Seed a first memory</h1>
            <p className="mb-4" style={{ color: 'var(--text-mid)' }}>
              Optional. Add one thing you'd want your AI agent to remember about you or your work.
              You can always skip this and let memories accumulate naturally from your conversations.
            </p>

            <label className="field-label">
              Memory content
            </label>
            <textarea
              value={seedContent}
              onChange={e => setSeedContent(e.target.value)}
              rows={3}
              placeholder="e.g. I prefer Fastify over Express for Node APIs"
              className="field mb-3"
            />

            <label className="field-label">
              Category
            </label>
            <select
              value={seedCategory}
              onChange={e => setSeedCategory(e.target.value)}
              className="field mb-4"
            >
              <option value="preference">Preference (likes/dislikes)</option>
              <option value="fact">Fact (objective truth)</option>
              <option value="pattern">Pattern (recurring workflow)</option>
              <option value="decision">Decision (choice + rationale)</option>
              <option value="outcome">Outcome (result of an action)</option>
            </select>

            <details className="mb-4">
              <summary className="text-sm cursor-pointer hover:underline" style={{ color: 'var(--accent)' }}>
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
                    className="block w-full text-left text-sm rounded p-2 transition-colors"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-mid)', border: '1px solid var(--border)' }}
                  >
                    <span className="font-medium text-xs uppercase mr-2 mono" style={{ color: 'var(--text-lo)' }}>
                      {ex.label}
                    </span>
                    {ex.content}
                  </button>
                ))}
              </div>
            </details>

            {error && (
              <div className="text-sm mb-2" style={{ color: 'var(--danger)' }}>{error}</div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🎉</span>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-hi)' }}>You're set</h1>
            </div>
            <p className="mb-3" style={{ color: 'var(--text-mid)' }}>
              Engram is running on your machine. Once your AI agent is connected, it can
              <code className="text-sm px-1 py-0.5 rounded mx-1 mono" style={{ background: 'var(--surface-2)', color: 'var(--text-hi)' }}>engram_remember</code>
              and
              <code className="text-sm px-1 py-0.5 rounded mx-1 mono" style={{ background: 'var(--surface-2)', color: 'var(--text-hi)' }}>engram_recall</code>
              memories about you across sessions.
            </p>
            <p style={{ color: 'var(--text-mid)' }}>
              From the dashboard you can browse, search, edit, and resolve memory conflicts.
              The Agents page has integration guides if you skipped that step.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between pt-6" style={{ borderTop: '1px solid var(--border-soft)' }}>
          <button
            type="button"
            onClick={finish}
            className="btn btn--ghost btn--sm"
          >
            Skip onboarding
          </button>

          <div className="flex gap-2">
            {step > 0 && step < STEPS.length - 1 && (
              <button
                type="button"
                onClick={back}
                className="btn btn--ghost"
              >
                Back
              </button>
            )}

            {step < 2 && (
              <button
                type="button"
                onClick={next}
                className="btn btn--primary"
              >
                Next
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={saveSeedAndNext}
                disabled={saving}
                className="btn btn--primary"
              >
                {saving ? 'Saving…' : seedContent.trim() ? 'Save & continue' : 'Skip this step'}
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={finish}
                className="btn btn--primary"
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
