/** @type {import('tailwindcss').Config} */
// Cortex design system. The app forces dark (html.dark + darkMode:'class'),
// and Tailwind's neutral/brand ramps are remapped onto the Cortex tokens so
// the existing utility classes across src/ render on-brand. Colors mirror the
// --* variables in src/styles/globals.css.
const accent = {
  50: "#eef0ff", 100: "#e0e3ff", 200: "#c4caff", 300: "#a5adff",
  400: "#8b95ff", 500: "#6d7bff", 600: "#6d7bff", 700: "#5563e6",
  800: "#4451c4", 900: "#3a4596", 950: "#222a5e",
};
const trace = {
  50: "#dffafa", 100: "#bff3f3", 200: "#8fe8e8", 300: "#34e0e0",
  400: "#34e0e0", 500: "#2bc4c4", 600: "#23a3a3", 700: "#1d8585",
  800: "#176868", 900: "#124f4f", 950: "#0a2e2e",
};
// Dark neutral ramp: light shades = light text, dark shades = surfaces.
const gray = {
  50: "#eaf0fb", 100: "#dbe3f3", 200: "#b9c4da", 300: "#97a6c2",
  400: "#7e8eac", 500: "#5d6c89", 600: "#2e3a58", 700: "#212c44",
  800: "#131b2e", 900: "#0d1322", 950: "#05070d",
};
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["Space Grotesk", "IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "SF Mono", "monospace"],
      },
      colors: {
        gray,
        slate: gray,
        // Old brand hues collapse onto the accent (indigo) + trace (cyan).
        blue: accent,
        indigo: accent,
        sky: accent,
        cyan: trace,
        accent: { DEFAULT: "var(--accent)", press: "var(--accent-press)" },
        surface: {
          DEFAULT: "rgba(var(--surface), <alpha-value>)",
          raised: "rgba(var(--surface-raised), <alpha-value>)",
        },
        brand: {
          primary: "rgba(var(--brand-primary), <alpha-value>)",
          accent: "rgba(var(--brand-accent), <alpha-value>)",
        },
        cat: {
          preference: "var(--cat-preference)",
          fact: "var(--cat-fact)",
          pattern: "var(--cat-pattern)",
          decision: "var(--cat-decision)",
          outcome: "var(--cat-outcome)",
        },
      },
      borderRadius: { DEFAULT: "10px" },
    },
  },
  plugins: [],
};
