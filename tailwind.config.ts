import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette reprise de l'identite Laketricity (teal + orange du logo).
        brand: {
          50: "#eaf6fa",
          100: "#cfeaf3",
          200: "#a3d6e8",
          300: "#6cbdda",
          400: "#3aa1c7",
          500: "#1687b0",
          600: "#006f9c",
          700: "#005a80",
          800: "#004763",
          900: "#00344a",
        },
        accent: {
          50: "#fff4e2",
          100: "#ffe4b8",
          200: "#ffcf85",
          300: "#ffb84e",
          400: "#fca527",
          500: "#f39815",
          600: "#d97f0a",
          700: "#b56508",
          800: "#8a4d08",
          900: "#5c3306",
        },
      },
      fontFamily: {
        sans: ["var(--font-mulish)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-raleway)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
