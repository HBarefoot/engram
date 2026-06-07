import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TrendsChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-ink-mid text-center py-8">No trend data available</p>;
  }

  // Format dates for display
  const formatted = data.map(d => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#212c44" opacity={0.3} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#97a6c2' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#97a6c2' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            color: 'var(--text-hi)',
            fontSize: '0.75rem'
          }}
          labelStyle={{ color: 'var(--text-mid)' }}
          itemStyle={{ color: 'var(--text-mid)' }}
        />
        <Line
          type="monotone"
          dataKey="created"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          name="Created"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
