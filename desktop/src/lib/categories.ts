// Single source of truth for memory-category colors (Cortex palette).
// Mirrors the --cat-* design tokens in src/styles/globals.css.
export const CATEGORY_COLORS: Record<string, string> = {
  preference: "#a78bfa",
  fact: "#38bdf8",
  pattern: "#34d399",
  decision: "#fbbf24",
  outcome: "#fb7185",
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "#5d6c89";
}

// Shared dark tooltip style for Recharts (Cortex surfaces).
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#131b2e",
  border: "1px solid #212c44",
  borderRadius: "12px",
  color: "#eaf0fb",
  fontSize: "0.75rem",
} as const;

export const CHART_AXIS_COLOR = "#97a6c2";
export const CHART_GRID_COLOR = "#212c44";
