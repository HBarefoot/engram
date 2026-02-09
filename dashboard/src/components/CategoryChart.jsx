import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const CATEGORY_COLORS = {
  preference: '#a855f7',
  fact: '#3b82f6',
  pattern: '#22c55e',
  decision: '#eab308',
  outcome: '#ef4444'
};

export default function CategoryChart({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No data</p>;
  }

  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No memories yet</p>;
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
              <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#6b7280'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#f3f4f6',
              fontSize: '0.75rem'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5">
        {chartData.map(entry => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[entry.name] || '#6b7280' }}
            />
            <span className="capitalize text-gray-700 dark:text-gray-300">{entry.name}</span>
            <span className="ml-auto text-gray-500 dark:text-gray-400">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
