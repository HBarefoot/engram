// Single source of truth for memory-category presentation (Cortex palette).
// Hexes mirror the --cat-* design tokens in design-system.css. Recharts and
// other non-CSS consumers read CATEGORY_COLORS; DOM badges use categoryBadgeClass.

export const CATEGORIES = ['preference', 'fact', 'pattern', 'decision', 'outcome'];

export const CATEGORY_COLORS = {
  preference: '#a78bfa',
  fact: '#38bdf8',
  pattern: '#34d399',
  decision: '#fbbf24',
  outcome: '#fb7185',
};

/** Tailwind/design-system badge classes for a category pill. */
export function categoryBadgeClass(category) {
  return CATEGORIES.includes(category)
    ? `badge badge--${category}`
    : 'badge badge--neutral';
}

/** Chart/SVG color for a category, with a neutral fallback. */
export function categoryColor(category) {
  return CATEGORY_COLORS[category] || 'var(--text-lo)';
}
