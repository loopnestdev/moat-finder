import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-navy-950",
    "bg-navy-900",
    "bg-navy-800",
    "bg-navy-700",
    "text-cream",
    "text-gold",
    "border-gold",
    "font-display",
    "font-body",
    "font-mono",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: [
          "Inter",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        body: ["Inter", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        mono: [
          '"Source Code Pro"',
          '"JetBrains Mono"',
          "ui-monospace",
          "monospace",
        ],
      },
      colors: {
        // Score colours — semantic, keep exactly
        "score-high": "#10b981",
        "score-mid": "#fbbf24",
        "score-low": "#ef4444",
        moat: "#fb923c",
        revenue: "#34d399",
        // Supabase-inspired dark surface hierarchy
        navy: {
          950: "#0f0f0f",
          900: "#171717",
          800: "#1a1a1a",
          750: "#1d1d1d",
          700: "#2e2e2e",
          600: "#363636",
          400: "#434343",
          300: "#4d4d4d",
        },
        // Supabase neutral text scale
        cream: {
          DEFAULT: "#fafafa",
          muted: "#b4b4b4",
          subtle: "#898989",
        },
        // moat-finder gold — keep for key financial data per spec
        gold: {
          DEFAULT: "#d4a853",
          light: "#e8c07a",
          dark: "#a87c35",
        },
        // Supabase brand green
        green: {
          DEFAULT: "#3ecf8e",
          link: "#00c573",
          border: "rgba(62,207,142,0.3)",
        },
      },
      keyframes: {
        "pulse-glow-emerald": {
          "0%, 100%": { filter: "drop-shadow(0 0 4px #10b98160)" },
          "50%": { filter: "drop-shadow(0 0 10px #10b981aa)" },
        },
        "pulse-glow-amber": {
          "0%, 100%": { filter: "drop-shadow(0 0 4px #fbbf2460)" },
          "50%": { filter: "drop-shadow(0 0 10px #fbbf24aa)" },
        },
        "pulse-glow-red": {
          "0%, 100%": { filter: "drop-shadow(0 0 4px #ef444460)" },
          "50%": { filter: "drop-shadow(0 0 10px #ef4444aa)" },
        },
      },
      animation: {
        "pulse-glow-emerald": "pulse-glow-emerald 2.4s ease-in-out infinite",
        "pulse-glow-amber": "pulse-glow-amber 2.4s ease-in-out infinite",
        "pulse-glow-red": "pulse-glow-red 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
