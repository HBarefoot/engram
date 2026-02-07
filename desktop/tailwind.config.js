/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgba(var(--surface), <alpha-value>)",
          raised: "rgba(var(--surface-raised), <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
