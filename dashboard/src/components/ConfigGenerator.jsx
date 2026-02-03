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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Configuration for {platformConfig.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Config file location: <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">{platformConfig.configPath}</code>
        </p>
      </div>

      {/* Installation Path Validation */}
      <div className={`p-4 rounded-lg border ${
        validationStatus?.valid
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      }`}>
        <div className="flex items-center space-x-2">
          <span className="text-xl">
            {validationStatus?.valid ? '✅' : '⚠️'}
          </span>
          <div className="flex-1">
            <p className="font-medium text-sm">
              Installation Path: {validationStatus?.valid ? 'Valid' : 'Check Required'}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-all">
              {installationPath}
            </p>
          </div>
        </div>
      </div>

      {/* Config Preview */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Copy this configuration
          </label>
          <button
            onClick={handleCopy}
            className="px-3 py-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
        <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm">
          <code>{configString}</code>
        </pre>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
          Setup Instructions
        </h4>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-300">
          {platformConfig.instructions.map((instruction, index) => (
            <li key={index}>{instruction}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
