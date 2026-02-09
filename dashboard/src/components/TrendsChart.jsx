import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TrendsChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No trend data available</p>;
  }

  // Format dates for display
  const formatted = data.map(d => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '0.5rem',
            color: '#f3f4f6',
            fontSize: '0.75rem'
          }}
        />
        <Line
          type="monotone"
          dataKey="created"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          name="Created"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
