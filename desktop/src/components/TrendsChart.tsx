import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "0.5rem",
            color: "#f3f4f6",
            fontSize: "0.75rem",
          }}
        />
        <Line type="monotone" dataKey="created" stroke="#6366f1" strokeWidth={2} dot={false} name="Created" />
      </LineChart>
    </ResponsiveContainer>
  );
}
