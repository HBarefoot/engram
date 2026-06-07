import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_TOOLTIP_STYLE, CHART_AXIS_COLOR, CHART_GRID_COLOR } from "../lib/categories";

interface TrendPoint {
  date: string;
  created: number;
  avgConfidence?: number;
  label?: string;
}

interface TrendsChartProps {
  data?: TrendPoint[];
}

export default function TrendsChart({ data }: TrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "rgba(var(--text-secondary), 1)" }}>
        No trend data available
      </p>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} opacity={0.5} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} allowDecimals={false} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Line type="monotone" dataKey="created" stroke="#6d7bff" strokeWidth={2} dot={false} name="Created" />
      </LineChart>
    </ResponsiveContainer>
  );
}
