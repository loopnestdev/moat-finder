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
        display: ['"Plus Jakarta Sans"', "sans-serif"],
        body: ['"Plus Jakarta Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // Score colours — semantic, keep exactly
        "score-high": "#10b981",
        "score-mid": "#f59e0b",
        "score-low": "#ef4444",
        moat: "#fb923c",
        revenue: "#34d399",
        // Stripe dark adaptation — purple-tinted surface hierarchy
        navy: {
          950: "#06091a",
          900: "#0d1b38",
          800: "#1c1e54",
          750: "#22256a",
          700: "#2a2e7a",
          600: "#362baa",
          400: "#533afd",
          300: "#b9b9f9",
        },
        // White text scale for dark-mode adaptation
        cream: {
          DEFAULT: "#ffffff",
          muted: "rgba(255,255,255,0.70)",
          subtle: "rgba(255,255,255,0.45)",
        },
        // moat-finder gold — keep for key financial data per spec
        gold: {
          DEFAULT: "#d4a853",
          light: "#e8c07a",
          dark: "#a87c35",
        },
        // Stripe purple scale
        purple: {
          DEFAULT: "#533afd",
          dark: "#4434d4",
          deep: "#2e2b8c",
          light: "#b9b9f9",
          mid: "#665efd",
        },
        // Stripe accent colors
        ruby: "#ea2261",
        magenta: "#f96bee",
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
