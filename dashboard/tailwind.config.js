/** @type {import('tailwindcss').Config} */
// Tailwind is mapped onto the Cortex design-system CSS variables (defined in
// design-system.css). Use utilities for layout; the var-backed colors/fonts
// keep ad-hoc utility classes on-brand. Single dark theme — no darkMode.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          press: 'var(--accent-press)',
          soft: 'var(--accent-soft)',
          line: 'var(--accent-line)',
        },
        trace: 'var(--trace)',
        surface: {
          app: 'var(--bg-app)',
          sunken: 'var(--bg-sunken)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          hi: 'var(--surface-hi)',
          sidebar: 'var(--sidebar)',
        },
        ink: {
          hi: 'var(--text-hi)',
          mid: 'var(--text-mid)',
          lo: 'var(--text-lo)',
        },
        line: {
          DEFAULT: 'var(--border)',
          soft: 'var(--border-soft)',
          strong: 'var(--border-strong)',
        },
        success: 'var(--success)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        cat: {
          preference: 'var(--cat-preference)',
          fact: 'var(--cat-fact)',
          pattern: 'var(--cat-pattern)',
          decision: 'var(--cat-decision)',
          outcome: 'var(--cat-outcome)',
        },
        // Back-compat alias: legacy `primary-*` classes resolve to the accent.
        primary: {
          50: 'var(--accent-soft)',
          100: 'var(--accent-soft)',
          200: 'var(--accent-line)',
          300: 'var(--accent)',
          400: 'var(--accent)',
          500: 'var(--accent)',
          600: 'var(--accent)',
          700: 'var(--accent-press)',
          800: 'var(--accent-press)',
          900: 'var(--accent-press)',
        },
      },
      fontFamily: {
        display: 'var(--font-display)',
        sans: 'var(--font-ui)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        card: 'var(--sh-1)',
        pop: 'var(--sh-2)',
        'pop-lg': 'var(--sh-3)',
        glow: 'var(--glow)',
        ring: 'var(--ring)',
      },
    },
  },
  plugins: [],
}
