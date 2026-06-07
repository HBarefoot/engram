import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CATEGORY_COLORS } from '../utils/categories';

export default function CategoryChart({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-ink-mid text-center py-8">No data</p>;
  }

  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return <p className="text-sm text-ink-mid text-center py-8">No memories yet</p>;
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={180}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            dataKey="value"
            stroke="none"
          >
            {chartData.map(entry => (
              <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || 'var(--text-lo)'} />
            ))}
          </Pie>
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
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5">
        {chartData.map(entry => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[entry.name] || 'var(--text-lo)' }}
            />
            <span className="capitalize text-ink-hi">{entry.name}</span>
            <span className="ml-auto text-ink-mid">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
