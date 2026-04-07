import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'score-high': '#10b981', // emerald-500
        'score-mid':  '#fbbf24', // amber-400
        'score-low':  '#ef4444', // red-500
        'moat':       '#fb923c', // orange-400
        'revenue':    '#34d399', // emerald-400
      },
    },
  },
  plugins: [],
} satisfies Config;
