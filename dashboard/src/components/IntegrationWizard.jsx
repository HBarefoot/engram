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
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading installation info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Integration Setup Wizard
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Step {currentStep === STEPS.SELECT_PLATFORM ? '1' : currentStep === STEPS.GENERATE_CONFIG ? '2' : '3'} of 3
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
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
                <div className={`h-2 rounded-full ${currentStep !== STEPS.SELECT_PLATFORM ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
              </div>
              <div className={`flex-1 ml-2 ${currentStep === STEPS.VERIFY ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`h-2 rounded-full ${currentStep === STEPS.VERIFY ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
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
              <div className="flex justify-between pt-4">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setCurrentStep(STEPS.VERIFY)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
                >
                  Next: Verify Setup →
                </button>
              </div>
            </div>
          )}

          {currentStep === STEPS.VERIFY && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-xl font-semibold text-green-900 dark:text-green-200 mb-2">
                  Configuration Ready!
                </h3>
                <p className="text-green-800 dark:text-green-300">
                  Your Engram MCP configuration has been generated. Follow the instructions above to complete the setup.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                  Next Steps
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
                  <li>Paste the configuration into your config file</li>
                  <li>Restart your AI application</li>
                  <li>Test the integration by asking about Engram</li>
                  <li>Check the Agents page for activity</li>
                </ol>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  ← Back
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
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
