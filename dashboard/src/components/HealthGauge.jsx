export default function HealthGauge({ score }) {
  const radius = 70;
  const stroke = 10;
  const center = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const color = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warn)' : 'var(--danger)';
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Unhealthy';

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
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
          className="font-display font-bold"
          style={{ fontSize: '2rem', fill: 'var(--text-hi)' }}
        >
          {score}
        </text>
        <text
          x={center}
          y={center + 18}
          textAnchor="middle"
          style={{ fontSize: '0.75rem', fill: 'var(--text-mid)' }}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
