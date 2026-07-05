import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import PlatformSelector from './PlatformSelector';
import ConfigGenerator from './ConfigGenerator';

const STEPS = {
  SELECT_PLATFORM: 'select',
  GENERATE_CONFIG: 'generate',
  VERIFY: 'verify'
};

export default function IntegrationWizard({ onClose }) {
  const [currentStep, setCurrentStep] = useState(STEPS.SELECT_PLATFORM);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [installationInfo, setInstallationInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skillCopied, setSkillCopied] = useState(false);

  const copySkillCommand = async () => {
    try {
      await navigator.clipboard.writeText('engram skill install');
      setSkillCopied(true);
      setTimeout(() => setSkillCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    loadInstallationInfo();
  }, []);

  async function loadInstallationInfo() {
    try {
      setLoading(true);
      const info = await api.getInstallationInfo();
      setInstallationInfo(info);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handlePlatformSelect = (platform) => {
    setSelectedPlatform(platform);
    setCurrentStep(STEPS.GENERATE_CONFIG);
  };

  const handleBack = () => {
    if (currentStep === STEPS.GENERATE_CONFIG) {
      setCurrentStep(STEPS.SELECT_PLATFORM);
    } else if (currentStep === STEPS.VERIFY) {
      setCurrentStep(STEPS.GENERATE_CONFIG);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: '360px' }}>
          <div className="modal__body text-center">
            <div className="spinner mx-auto"></div>
            <p className="mt-4" style={{ color: 'var(--text-mid)' }}>Loading installation info...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '56rem' }}>
        <div className="modal__body">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-hi)' }}>
                Integration Setup Wizard
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-mid)' }}>
                Step {currentStep === STEPS.SELECT_PLATFORM ? '1' : currentStep === STEPS.GENERATE_CONFIG ? '2' : '3'} of 3
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn btn--icon btn--ghost"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className={`flex-1 ${currentStep !== STEPS.SELECT_PLATFORM ? 'opacity-100' : 'opacity-50'}`}>
                <div className="h-2 rounded-full" style={{ background: currentStep !== STEPS.SELECT_PLATFORM ? 'var(--accent)' : 'var(--surface-3)' }}></div>
              </div>
              <div className={`flex-1 ml-2 ${currentStep === STEPS.VERIFY ? 'opacity-100' : 'opacity-50'}`}>
                <div className="h-2 rounded-full" style={{ background: currentStep === STEPS.VERIFY ? 'var(--accent)' : 'var(--surface-3)' }}></div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg p-3" style={{ borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)', border: '1px solid', background: 'color-mix(in oklab, var(--danger) 10%, var(--surface-1))' }}>
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          {/* Step Content */}
          {currentStep === STEPS.SELECT_PLATFORM && (
            <PlatformSelector
              onSelect={handlePlatformSelect}
              selectedPlatform={selectedPlatform}
            />
          )}

          {currentStep === STEPS.GENERATE_CONFIG && installationInfo && (
            <div className="space-y-6">
              <ConfigGenerator
                platform={selectedPlatform}
                installationPath={installationInfo.installation.binPath}
                platformOS={installationInfo.installation.platform}
              />

              {/* Skill install — the judgment layer that teaches agents to use memory well */}
              <div className="card card--pad" style={{ borderColor: 'color-mix(in oklab, var(--accent) 30%, transparent)', background: 'color-mix(in oklab, var(--accent) 8%, var(--surface-1))' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1" style={{ color: 'var(--text-hi)' }}>
                      Teach your agent to use memory well
                    </h4>
                    <p className="text-sm mb-3" style={{ color: 'var(--text-mid)' }}>
                      The config above gives your agent the memory tools. This one-time install adds the{' '}
                      <code className="mono px-1 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-hi)' }}>engram-memory</code>{' '}
                      skill — the judgment layer that teaches it <em>when</em> to recall and <em>what</em> to store.
                      Works in Claude Code, Cowork, or any <code className="mono">.agents/skills</code> framework.
                    </p>
                    <pre className="p-3 rounded-lg overflow-x-auto text-sm mono" style={{ background: 'var(--surface-2)', color: 'var(--text-hi)', border: '1px solid var(--border)' }}>
                      <code>engram skill install</code>
                    </pre>
                  </div>
                  <button onClick={copySkillCommand} className="btn btn--sm">
                    {skillCopied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={handleBack}
                  className="btn btn--ghost"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setCurrentStep(STEPS.VERIFY)}
                  className="btn btn--primary"
                >
                  Next: Verify Setup →
                </button>
              </div>
            </div>
          )}

          {currentStep === STEPS.VERIFY && (
            <div className="space-y-4">
              <div className="card card--pad text-center" style={{ borderColor: 'color-mix(in oklab, var(--success) 35%, transparent)', background: 'color-mix(in oklab, var(--success) 10%, var(--surface-1))' }}>
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--success)' }}>
                  Configuration Ready!
                </h3>
                <p style={{ color: 'var(--text-mid)' }}>
                  Your Engram MCP configuration has been generated. Follow the instructions above to complete the setup.
                </p>
              </div>

              <div className="card card--pad" style={{ borderColor: 'color-mix(in oklab, var(--info) 30%, transparent)', background: 'color-mix(in oklab, var(--info) 8%, var(--surface-1))' }}>
                <h4 className="font-semibold mb-2" style={{ color: 'var(--info)' }}>
                  Next Steps
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: 'var(--text-mid)' }}>
                  <li>Paste the configuration into your config file</li>
                  <li>Restart your AI application</li>
                  <li>Test the integration by asking about Engram</li>
                  <li>Check the Agents page for activity</li>
                </ol>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={handleBack}
                  className="btn btn--ghost"
                >
                  ← Back
                </button>
                <button
                  onClick={onClose}
                  className="btn btn--primary"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
