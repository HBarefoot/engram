export default function HealthGauge({ score }) {
  const radius = 70;
  const stroke = 10;
  const center = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Unhealthy';

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          className="fill-gray-900 dark:fill-white text-3xl font-bold"
          style={{ fontSize: '2rem' }}
        >
          {score}
        </text>
        <text
          x={center}
          y={center + 18}
          textAnchor="middle"
          className="fill-gray-500 dark:fill-gray-400"
          style={{ fontSize: '0.75rem' }}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
