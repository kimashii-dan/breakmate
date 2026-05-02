import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bm: {
          bg:               'var(--bm-bg)',
          surface:          'var(--bm-surface)',
          elevated:         'var(--bm-elevated)',
          border:           'var(--bm-border)',
          accent:           'var(--bm-accent)',
          'accent-hover':   'var(--bm-accent-hover)',
          'accent-muted':   'var(--bm-accent-muted)',
          success:          'var(--bm-success)',
          warning:          'var(--bm-warning)',
          thumb:            'var(--bm-thumb)',
          'text-primary':   'var(--bm-text-primary)',
          'text-secondary': 'var(--bm-text-secondary)',
          'text-muted':     'var(--bm-text-muted)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
