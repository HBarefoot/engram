import { useState, useEffect } from 'react';
import { getPlatformConfig } from '../data/platformConfigs';

export default function ConfigGenerator({ platform, installationPath, platformOS }) {
  const [copied, setCopied] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);

  const platformConfig = getPlatformConfig(platform, installationPath, platformOS);

  if (!platformConfig) return null;

  const configString = JSON.stringify(platformConfig.config, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(configString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const validatePath = () => {
    if (installationPath && installationPath.includes('/bin/engram.js')) {
      setValidationStatus({ valid: true, message: 'Path looks correct' });
    } else {
      setValidationStatus({ valid: false, message: 'Path may be incorrect' });
    }
  };

  useEffect(() => {
    validatePath();
  }, [installationPath]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-hi)' }}>
          Configuration for {platformConfig.name}
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-mid)' }}>
          Config file location: <code className="mono px-2 py-1 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-hi)', border: '1px solid var(--border)' }}>{platformConfig.configPath}</code>
        </p>
      </div>

      {/* Installation Path Validation */}
      <div
        className="p-4 rounded-lg border"
        style={
          validationStatus?.valid
            ? { borderColor: 'color-mix(in oklab, var(--success) 35%, transparent)', background: 'color-mix(in oklab, var(--success) 10%, var(--surface-1))' }
            : { borderColor: 'color-mix(in oklab, var(--warn) 35%, transparent)', background: 'color-mix(in oklab, var(--warn) 10%, var(--surface-1))' }
        }
      >
        <div className="flex items-center space-x-2">
          <span className="text-xl">
            {validationStatus?.valid ? '✅' : '⚠️'}
          </span>
          <div className="flex-1">
            <p className="font-medium text-sm" style={{ color: 'var(--text-hi)' }}>
              Installation Path: {validationStatus?.valid ? 'Valid' : 'Check Required'}
            </p>
            <p className="text-xs mt-1 break-all mono" style={{ color: 'var(--text-mid)' }}>
              {installationPath}
            </p>
          </div>
        </div>
      </div>

      {/* Config Preview */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <label className="field-label" style={{ marginBottom: 0 }}>
            Copy this configuration
          </label>
          <button
            onClick={handleCopy}
            className="btn btn--sm"
          >
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
        <pre className="p-4 rounded-lg overflow-x-auto text-sm mono" style={{ background: 'var(--surface-2)', color: 'var(--text-hi)', border: '1px solid var(--border)' }}>
          <code>{configString}</code>
        </pre>
      </div>

      {/* Instructions */}
      <div className="card card--pad" style={{ borderColor: 'color-mix(in oklab, var(--info) 30%, transparent)', background: 'color-mix(in oklab, var(--info) 8%, var(--surface-1))' }}>
        <h4 className="font-semibold mb-2" style={{ color: 'var(--info)' }}>
          Setup Instructions
        </h4>
        <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: 'var(--text-mid)' }}>
          {platformConfig.instructions.map((instruction, index) => (
            <li key={index}>{instruction}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
