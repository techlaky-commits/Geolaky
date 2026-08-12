import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          500: "#1f7aec",
          600: "#1763c2",
          700: "#124d97",
          900: "#0b2f5c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
