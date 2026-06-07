import { getPlatformList } from '../data/platformConfigs';

export default function PlatformSelector({ onSelect, selectedPlatform }) {
  const platforms = getPlatformList();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium" style={{ color: 'var(--text-hi)' }}>
        Select Your Platform
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            onClick={() => onSelect(platform.id)}
            className="card card--pad relative text-left transition-all"
            style={
              selectedPlatform === platform.id
                ? { borderColor: 'var(--accent-line)', boxShadow: 'var(--glow)' }
                : undefined
            }
          >
            {platform.popular && (
              <span className="badge badge--neutral absolute top-2 right-2" style={{ color: 'var(--accent)', borderColor: 'var(--accent-line)', background: 'var(--accent-soft)' }}>
                Popular
              </span>
            )}
            <div className="flex items-start space-x-4">
              <div className="text-4xl">{platform.icon}</div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1" style={{ color: 'var(--text-hi)' }}>
                  {platform.name}
                </h4>
                <p className="text-sm" style={{ color: 'var(--text-mid)' }}>
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
