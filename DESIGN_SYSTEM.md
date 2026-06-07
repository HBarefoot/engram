# Engram Design System — "Cortex"

The shared visual language for every Engram surface: the web dashboard
(`dashboard/`), the macOS desktop app (`desktop/`), and the repo/README brand.
It is implemented as CSS custom properties plus a small set of component
classes, and ships a single dark theme. Everything is **offline** — no Google
Fonts, no CDNs.

> A second direction, "Trace" (warm graphite / amber / mono-forward), exists in
> the original design exploration. It is intentionally **not shipped**. The
> tokens are authored on `:root` (= Cortex) so a future `[data-theme="trace"]`
> toggle would be pure CSS, but no toggle exists today.

## The mark — "Bloom"

A dodecahedron net: a core pentagon ringed by five faces that each share one of
its edges, with a node at every petal apex and one at the center — recall
blossoming outward from a core. Canonical vector sources live in `assets/brand/`:

| File | Use |
|------|-----|
| `assets/brand/engram-mark.svg` | Flat mark, accent stroke. Menu-bar/tray, favicon, sidebar, inline. |
| `assets/brand/engram-icon.svg` | Gradient squircle tile (white mark). macOS Dock / app icon. |

The React shell renders the same geometry inline via `BloomMark` in
`dashboard/src/components/icons.jsx`.

All rasters (PNG icon set, `.icns`, tray icons, favicons, the 180px README logo)
are generated deterministically from those two SVGs:

```bash
node scripts/generate-brand.js
```

It uses `@resvg/resvg-js` (pure JS) plus macOS `sips`/`iconutil`. Re-run it after
editing either SVG; commit the regenerated assets.

## Color tokens (Cortex)

CSS variables, defined in `dashboard/src/design-system.css` and
`desktop/src/styles/globals.css`.

| Token | Hex | Role |
|-------|-----|------|
| `--bg-sunken` | `#05070d` | App backdrop |
| `--bg-app` | `#080b14` | Body |
| `--surface-1` | `#0d1322` | Cards |
| `--surface-2` | `#131b2e` | Insets, inputs |
| `--surface-3` | `#1a2238` | Raised controls |
| `--surface-hi` | `#212c46` | Selected/hover |
| `--sidebar` | `#090d18` | Nav rail |
| `--border` / `--border-soft` / `--border-strong` | `#212c44` / `#1a2236` / `#2e3a58` | Hairlines |
| `--text-hi` / `--text-mid` / `--text-lo` | `#eaf0fb` / `#97a6c2` / `#5d6c89` | Text ramp |
| `--accent` / `--accent-press` | `#6d7bff` / `#5563e6` | Primary indigo |
| `--trace` | `#34e0e0` | Secondary cyan ("memory trace") |
| `--grad` | `linear-gradient(120deg,#6d7bff,#34e0e0)` | Brand gradient |
| `--success` / `--warn` / `--danger` / `--info` | `#34d399` / `#fbbf24` / `#fb7185` / `#38bdf8` | Semantic |

### Memory categories (fixed semantic set)

Single source: `dashboard/src/utils/categories.js` and `desktop/src/lib/categories.ts`.

| Category | Token | Hex |
|----------|-------|-----|
| preference | `--cat-preference` | `#a78bfa` |
| fact | `--cat-fact` | `#38bdf8` |
| pattern | `--cat-pattern` | `#34d399` |
| decision | `--cat-decision` | `#fbbf24` |
| outcome | `--cat-outcome` | `#fb7185` |

Never hardcode category colors in a component — import from the categories
module (DOM badges via `categoryBadgeClass`, charts via `CATEGORY_COLORS`/`categoryColor`).

## Type

Self-hosted (`assets/brand/fonts/`, copied to each app's `public/fonts/` and
loaded via `<link rel="stylesheet" href="/fonts/fonts.css">`):

- **Display** — Space Grotesk (`--font-display`): headings, wordmark, stat values.
- **UI / body** — IBM Plex Sans (`--font-ui`): paragraphs, labels, controls.
- **Mono** — IBM Plex Mono (`--font-mono`): eyebrows, IDs, metrics, code.

## Shape & elevation

Radii `--r-sm 8 / --r-md 12 / --r-lg 16 / --r-xl 22 / --r-pill 999`. Shadows
`--sh-1/2/3`, plus `--glow` (accent ring) and `--ring` (focus). 4px spacing grid.

## Component classes

Defined in the design-system stylesheets; shared by both apps:

- **Buttons** — `btn`, `btn--primary`, `btn--ghost`, `btn--sm`, `btn--icon`
- **Badges** — `badge badge--{preference|fact|pattern|decision|outcome|neutral}`; status dot `dot` / `dot--live`
- **Cards** — `card` (`card--pad`, `card--inset`); stat tile `stat` › `stat__label` / `stat__value` / `stat__delta`
- **Inputs** — `field`, `field-label`, `search`, `segtabs` › `segtab`, `switch`, `bar`
- **Nav / data** — `nav-item` (`aria-current="true"` active), `row`, `tbl`
- **Shell** — `topbar`, `brandline`, `wordmark` (`.grad`), `ver`, `app-icon` (`app-icon--grad`), `sidebar`, `page` / `page-head`
- **Type utils** — `eyebrow`, `mono`, `muted`, `dim`

## Per-surface wiring

- **Web dashboard** — Tailwind maps onto the tokens (see `dashboard/tailwind.config.js`); use utilities for layout, component classes for chrome. Single dark theme (no `darkMode`).
- **Desktop** — forces dark (`html.dark`, `darkMode:'class'`); Tailwind's `gray` ramp and `blue`/`indigo`/`sky`/`cyan` hues are remapped onto Cortex neutrals + accent/trace so existing utility classes render on-brand. Legacy `--surface`/`--brand-*` vars are aliased to Cortex values.
