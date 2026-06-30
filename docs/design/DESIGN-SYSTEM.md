# Engram Design System — Component Guide

This is the **component design system** for Engram, adopted from the "Engram Upgraded" design.
It is the source of truth for **how components look** (tokens + element styles).
It is **not** a layout spec — it does not dictate how any screen or page is arranged.
When building new UI, compose these components; arrange them however the screen needs.

Canonical stylesheet: [`engram-design-system.css`](./engram-design-system.css).

## How to use it

- **New UI is built from these tokens and component classes.** Don't invent new colors, radii, or one-off toggle/badge styles — reach for a token or a component here first.
- **Tokens over literals.** Use `var(--accent)`, `var(--surface-1)`, `var(--text-mid)`, etc. — never hardcoded hex.
- **Theme:** single dark "cortex" theme (`:root` / `[data-theme="cortex"]`).
- **Layout is per-screen.** Grids, page structure, and where a component sits are decided per view — this guide only standardizes the building blocks.
- In React, apply these as `className`s (the classes are framework-agnostic CSS); state-driven variants use data attributes (`data-on="true"`) or BEM-style modifier classes (`badge--fact`).

## Foundations (tokens)

**Type:** `--font-display` (Space Grotesk — headings/stat values), `--font-ui` (IBM Plex Sans — body/UI), `--font-mono` (IBM Plex Mono — labels, codes, metrics).

**Surfaces (back→front):** `--bg-sunken`, `--bg-app`, `--surface-1`, `--surface-2`, `--surface-3`, `--surface-hi`, plus `--sidebar`.

**Borders:** `--border`, `--border-soft`, `--border-strong`.

**Text:** `--text-hi` (primary), `--text-mid` (secondary), `--text-lo` (tertiary/labels), `--text-on-accent`.

**Accent / trace:** `--accent` (#6d7bff) with `--accent-press`, `--accent-soft`, `--accent-line`; `--trace` (#34e0e0, recall/data lines); `--grad` (brand gradient for wordmark/icons).

**Status:** `--success` #34d399, `--warn` #fbbf24, `--danger` #fb7185, `--info` #38bdf8.

**Radii:** `--r-sm` 8 · `--r-md` 12 · `--r-lg` 16 · `--r-xl` 22 · `--r-pill` 999.

**Elevation/focus:** `--sh-1/2/3`, `--glow`, `--ring` (focus ring).

**Labels/eyebrows:** uppercase, mono, `0.14em` letter-spacing (`.eyebrow`).

### Memory category colors (canonical — keep consistent everywhere)

| Category | Token | Hex | Hue |
|---|---|---|---|
| preference | `--cat-preference` | `#a78bfa` | violet |
| fact | `--cat-fact` | `#38bdf8` | sky |
| pattern | `--cat-pattern` | `#34d399` | emerald |
| decision | `--cat-decision` | `#fbbf24` | amber |
| outcome | `--cat-outcome` | `#fb7185` | rose |

Use these for category badges, the category donut, and anywhere a memory's category is color-coded.

## Components

| Component | Class(es) | Use for |
|---|---|---|
| Button | `.btn` + `--primary` / `--ghost` / `--sm` / `--icon` | All actions. Primary = the main action; ghost = secondary; icon = icon-only. |
| Badge | `.badge` + `--preference/fact/pattern/decision/outcome/neutral` | Category tags, statuses. Lowercase, mono. |
| Status dot | `.dot`, `.dot--live` | Live/online indicator (`--live` pulses green). |
| Card | `.card`, `.card--pad`, `.card--inset` | Generic surface container. `--inset` for nested panels. |
| Stat tile | `.stat`, `.stat__label/__value/__delta`, `.stat__delta--up` | KPI/metric tiles (big tabular-nums value + delta). |
| Text field | `.field`, `.field-label`, `select.field` | Inputs and selects. Focus shows `--ring`. |
| Search | `.search` | Icon + input search bar. |
| Segmented tabs | `.segtabs`, `.segtab[aria-selected]` | Range/option switches (e.g. 24h / 7d / 30d). |
| **Toggle** | `.switch[data-on]` | **The canonical on/off toggle — use this, not ad-hoc Tailwind switches.** |
| Progress bar | `.bar` > `span` | Inline progress / coverage / hit-rate bars. |
| Nav item | `.nav-item[aria-current]` | Sidebar navigation entries. |
| Row | `.row` | Divided list rows. |
| Table | `.tbl`, `td.hi` | Data tables (mono uppercase headers). |
| Chip / filter | `.chip[data-on]` | Pill filters (e.g. all / recall / remember / conflicts). |
| View tab | `.vtab[data-on]` + `small` | Top-level mode switch (e.g. Command Center / Agent Trace / Atlas). |
| Activity row | `.ev-row` | Hoverable, expandable event/log rows. |
| Selectable card | `.agent-pick[data-on]` | Picker cards (e.g. agent picker). |
| Timeline connector | `.step-line` | Vertical connector between trace steps. |
| Sparkline | `.u-spark` (on `<svg>`) | Inline trend lines (keeps stroke crisp at any scale). |
| Spinner | `.spinner` | Loading. |
| Motion | `.pulse`, `.grow` | Live pulsing; bars/elements growing in. |

## Adoption notes

- The repo already ships a Cortex design system (`dashboard/src/design-system.css`, `DESIGN_SYSTEM.md`, and desktop `globals.css`). This file is the **refreshed, expanded** version (adds `--trace`, full status + category palettes, `.stat`, `.switch`, `.chip`, `.vtab`, `.agent-pick`, `.ev-row`, sparkline + motion helpers). Reconcile the live stylesheets to match these tokens/components so dashboard and desktop stay in sync.
- First place to apply it: the **v1.8.0 LLM observability UI** — build its status badge, stat tiles, activity rows, and toggle from these classes (the toggle here replaces the broken one).
- Keep this the single source of truth; update this guide + the CSS together when a component changes.
