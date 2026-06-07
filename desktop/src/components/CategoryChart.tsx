import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { categoryColor, CHART_TOOLTIP_STYLE } from "../lib/categories";

interface CategoryChartProps {
  data?: Record<string, number>;
}

export default function CategoryChart({ data }: CategoryChartProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "rgba(var(--text-secondary), 1)" }}>
        No data
      </p>
    );
  }

  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "rgba(var(--text-secondary), 1)" }}>
        No memories yet
      </p>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={180}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={categoryColor(entry.name)} />
            ))}
          </Pie>
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: categoryColor(entry.name) }}
            />
            <span className="capitalize text-gray-700 dark:text-gray-300">{entry.name}</span>
            <span className="ml-auto" style={{ color: "rgba(var(--text-secondary), 1)" }}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
