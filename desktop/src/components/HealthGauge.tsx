interface HealthGaugeProps {
  score: number;
}

export default function HealthGauge({ score }: HealthGaugeProps) {
  const radius = 70;
  const stroke = 10;
  const center = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const color = score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#fb7185";
  const label = score >= 80 ? "Healthy" : score >= 50 ? "Needs Attention" : "Unhealthy";

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#1a2238"
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
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          className="fill-gray-900 dark:fill-white"
          style={{ fontSize: "2rem", fontWeight: 700 }}
        >
          {score}
        </text>
        <text
          x={center}
          y={center + 18}
          textAnchor="middle"
          style={{ fontSize: "0.75rem", fill: "rgba(var(--text-secondary), 1)" }}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
