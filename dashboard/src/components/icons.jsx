// Inline SVG icons (stroke = currentColor) for the app shell + the Engram
// "Bloom" brand mark. Keeping them inline avoids extra network requests and
// lets them inherit color from .nav-item / .app-icon.

/** The Engram Bloom mark — dodecahedron-net flower. Inherits currentColor. */
export function BloomMark({ className }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M24.00 31.83 L 16.55 26.42 L 19.40 17.67 L 28.60 17.67 L 31.45 26.42 Z" />
      <path d="M24.00 31.83 L 16.55 26.42 L 9.11 31.83 L 11.95 40.58 L 21.16 40.58 Z" />
      <path d="M7.35 26.42 L 16.55 26.42 L 19.40 17.67 L 11.95 12.25 L 4.50 17.67 Z" />
      <path d="M24.00 3.50 L 16.55 8.91 L 19.40 17.67 L 28.60 17.67 L 31.45 8.91 Z" />
      <path d="M40.65 26.42 L 43.50 17.67 L 36.05 12.25 L 28.60 17.67 L 31.45 26.42 Z" />
      <path d="M24.00 31.83 L 26.84 40.58 L 36.05 40.58 L 38.89 31.83 L 31.45 26.42 Z" />
      <circle cx="11.95" cy="40.58" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="4.50" cy="17.67" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="24.00" cy="3.50" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="43.50" cy="17.67" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="36.05" cy="40.58" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="24.00" cy="24.00" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

const stroke = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round',
};
const Svg = (props) => <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke} {...props} />;

export const NAV_ICONS = {
  overview: <Svg><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>,
  memories: <Svg><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" /><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /></Svg>,
  search: <Svg><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>,
  statistics: <Svg><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M3 20h18" /></Svg>,
  health: <Svg><path d="M3 12h4l2 6 4-13 2 7h6" /></Svg>,
  conflicts: <Svg><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" /></Svg>,
  agents: <Svg><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M12 7V4" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /></Svg>,
  import: <Svg><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Svg>,
  download: <Svg><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></Svg>,
  plus: <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
};
