import { getPlatformList } from '../data/platformConfigs';

export default function PlatformSelector({ onSelect, selectedPlatform }) {
  const platforms = getPlatformList();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
        Select Your Platform
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            onClick={() => onSelect(platform.id)}
            className={`relative p-6 rounded-lg border-2 transition-all text-left ${
              selectedPlatform === platform.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {platform.popular && (
              <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-primary-200 rounded">
                Popular
              </span>
            )}
            <div className="flex items-start space-x-4">
              <div className="text-4xl">{platform.icon}</div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {platform.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {platform.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
