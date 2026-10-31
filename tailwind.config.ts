import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS variables (see globals.css) so the
        // whole app tracks one palette.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-soft': 'rgb(var(--muted-soft) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-2': 'rgb(var(--ink-2) / <alpha-value>)',
        amber: 'rgb(var(--amber) / <alpha-value>)',
        peri: 'rgb(var(--peri) / <alpha-value>)',
        mint: 'rgb(var(--tint-mint) / <alpha-value>)',
        lilac: 'rgb(var(--tint-lilac) / <alpha-value>)',
        sky: 'rgb(var(--tint-sky) / <alpha-value>)',
        blush: 'rgb(var(--tint-blush) / <alpha-value>)',
        sand: 'rgb(var(--tint-sand) / <alpha-value>)',
        debit: 'rgb(var(--debit) / <alpha-value>)',
        credit: 'rgb(var(--credit) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      screens: {
        xs: '420px',
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      boxShadow: {
        card: 'none',
        ink: '0 18px 40px -24px rgb(13 16 20 / 0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
