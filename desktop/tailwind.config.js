/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "rgba(var(--surface), <alpha-value>)",
          raised: "rgba(var(--surface-raised), <alpha-value>)",
        },
        brand: {
          primary: "rgba(var(--brand-primary), <alpha-value>)",
          accent: "rgba(var(--brand-accent), <alpha-value>)",
        },
      },
      borderRadius: {
        DEFAULT: "10px",
      },
    },
  },
  plugins: [],
};
