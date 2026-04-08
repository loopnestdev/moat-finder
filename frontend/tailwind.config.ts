import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Score colours (existing)
        'score-high': '#10b981',
        'score-mid':  '#fbbf24',
        'score-low':  '#ef4444',
        'moat':       '#fb923c',
        'revenue':    '#34d399',
        // Navy palette
        navy: {
          950: '#070d1a',
          900: '#0f1729',
          800: '#162035',
          700: '#1e2d47',
          600: '#2a3f5f',
          400: '#5a7aa8',
          300: '#8aacd4',
        },
        // Cream palette
        cream: {
          DEFAULT: '#f5f0e8',
          muted:   '#b8b0a0',
          subtle:  '#7a7268',
        },
        // Gold palette
        gold: {
          DEFAULT: '#c9a84c',
          light:   '#e4c97e',
          dark:    '#9a7530',
        },
      },
      keyframes: {
        'pulse-glow-emerald': {
          '0%, 100%': { filter: 'drop-shadow(0 0 4px #10b98160)' },
          '50%':      { filter: 'drop-shadow(0 0 10px #10b981aa)' },
        },
        'pulse-glow-amber': {
          '0%, 100%': { filter: 'drop-shadow(0 0 4px #fbbf2460)' },
          '50%':      { filter: 'drop-shadow(0 0 10px #fbbf24aa)' },
        },
        'pulse-glow-red': {
          '0%, 100%': { filter: 'drop-shadow(0 0 4px #ef444460)' },
          '50%':      { filter: 'drop-shadow(0 0 10px #ef4444aa)' },
        },
      },
      animation: {
        'pulse-glow-emerald': 'pulse-glow-emerald 2.4s ease-in-out infinite',
        'pulse-glow-amber':   'pulse-glow-amber 2.4s ease-in-out infinite',
        'pulse-glow-red':     'pulse-glow-red 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
